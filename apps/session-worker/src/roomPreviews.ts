import type { LiveSessionRoomAuthorization } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import { withCharacterControllers } from '@artificer-toolkit/shared/campaign/characterControl'
import {
  type CampaignSceneStateDto,
  type SceneTransientEnvelopeDto
} from '@artificer-toolkit/schema/api/vttScenes'
import {
  extendSceneMovementPath,
  isScenePointExplored,
  isSceneTokenVisibleToViewer,
  projectSceneTokenPreviewForViewer,
  SceneBarrierIndex,
  sceneFogOwnerFailure,
  sceneTransientStreamKey,
  type ScenePoint
} from '@artificer-toolkit/shared/vtt'
import { canPreviewSceneTokenDrag } from './nativeRoomSceneCommand.js'
import { attachment, send, viewer, type Admission, type SocketAttachment } from './roomSocket.js'
import {
  admitsRoomMember,
  roomBoundTokenControl,
  roomVisionCurrent,
  type BoundTokenControl
} from './roomAuthorization.js'
import { ROOM_LIMITS, SocketMessageBudget } from './roomLimits.js'
import type { RoomCommandHost } from './roomCommandHost.js'

/**
 * A preview stream's latest accepted sample and, for a token drag, its resolved path. Memory only
 * (ADR 0035 Amendment 15): hibernation or a restart loses it, and the next sample then starts from
 * the token's position.
 */
interface PreviewStream {
  baselineVersion: number
  path: ScenePoint[] | null
  sceneId: string
  sequence: number
}

/** The room steps preview fan-out uses. */
export type RoomPreviewsPort = Pick<
  RoomCommandHost,
  | 'authorization'
  | 'cache'
  | 'challenge'
  | 'liveAdmission'
  | 'presentationChanging'
  | 'refreshSceneCache'
  | 'waitUntil'
  | 'webSockets'
> & {
  overlayDurableSceneCache(sceneId: string): void
  refreshAuthorization(): Promise<LiveSessionRoomAuthorization>
  refreshAuthorizationInBackground(): void
  /** The socket's message budgets, once it has sent a message. */
  budget(socket: WebSocket): SocketMessageBudget | undefined
}

/**
 * Transient previews (token drags, pings, fog areas): validated against each stream's last sample
 * and fanned out from room memory only. A missing or stale input starts a background refresh.
 */
export class RoomPreviews {
  readonly #previewStreams = new Map<WebSocket, Map<string, PreviewStream>>()
  /** Background preview refreshes by input: at most one running and one start per retry window. */
  readonly #previewRefreshes = new Map<string, { running: boolean; startedAt: number }>()
  readonly #movementIndexes = new Map<
    string,
    { barriers: CampaignSceneStateDto['barriers']; index: SceneBarrierIndex }
  >()

  constructor(private readonly port: RoomPreviewsPort) {}

  /** Forgets a closed socket's preview streams. */
  drop(socket: WebSocket): void {
    this.#previewStreams.delete(socket)
  }

  /** Forgets the Scene barrier indexes, after the presented Scene or its authority changed. */
  clearMovementIndexes(): void {
    this.#movementIndexes.clear()
  }

  /**
   * Renders one preview sample from room memory within its message: the Scene cache, the members'
   * admissions and the authorization cache (membership, bound-token control and the Character
   * revisions behind the Scene's vision). A sample never calls or waits on Convex or storage. A
   * missing, stale or expired input starts a background refresh, and samples it cannot serve yet are
   * dropped, since previews are lossy (ADR 0035 Amendments 14 and 15).
   */
  broadcast(
    origin: WebSocket,
    originAdmission: Admission,
    envelope: SceneTransientEnvelopeDto
  ): void {
    if (this.port.presentationChanging()) return
    const originAttachment = attachment(origin)
    if (!originAttachment) return this.port.challenge(origin)
    // Broadcasts are refused while the authorization cache is stale or past its lease.
    const authorization = this.port.authorization.current(originAttachment.authorityEpoch)
    if (!authorization) return this.port.refreshAuthorizationInBackground()
    if (!admitsRoomMember(authorization, originAdmission)) return
    const candidates = this.port.webSockets().flatMap((socket) => {
      const candidate = this.port.liveAdmission(socket)
      if (!candidate) return (this.port.challenge(socket), [])
      return admitsRoomMember(authorization, candidate) ? [{ admission: candidate, socket }] : []
    })
    const cached = this.port.cache()
    if (!cached) return this.#refreshPreviewScene(originAttachment)
    const scene = cached.scene
    if (!scene || scene.id !== envelope.sceneId || scene.version !== envelope.baselineVersion)
      return
    let boundTokenControl: BoundTokenControl | null = null
    if (envelope.kind === 'TOKEN_DRAG_PREVIEW') {
      // A changed Character's vision rebuilds the Scene before drags preview it again (D33).
      if (!roomVisionCurrent(authorization, cached.characterRevisions))
        return this.#refreshPreviewVision(originAttachment)
      // A player's preview on an Encounter-bound Scene needs their bound-actor control (D25).
      if (originAdmission.role === 'PLAYER' && cached.encounterId !== null) {
        const play = this.port.authorization.currentPlay(originAttachment.authorityEpoch)
        boundTokenControl = play
          ? roomBoundTokenControl(play, originAdmission.userId, {
              sceneId: scene.id,
              encounterId: cached.encounterId
            })
          : null
        if (!boundTokenControl) return this.port.refreshAuthorizationInBackground()
      }
    }
    this.#sendTransient(
      origin,
      originAttachment,
      originAdmission,
      candidates,
      boundTokenControl,
      authorization.campaign.assignments,
      scene,
      envelope
    )
  }

  /** Starts `work` off the sample path unless it is running or started within the retry window. */
  #refreshPreviewInBackground(key: string, work: () => Promise<void>): void {
    const previous = this.#previewRefreshes.get(key)
    if (
      previous &&
      (previous.running || Date.now() - previous.startedAt < ROOM_LIMITS.previewRetryMs)
    )
      return
    const refresh = { running: true, startedAt: Date.now() }
    this.#previewRefreshes.set(key, refresh)
    this.port.waitUntil(
      work()
        .catch(() => undefined)
        .finally(() => {
          refresh.running = false
        })
    )
  }

  /** Rebuilds a missing or stale Scene cache in the background. */
  #refreshPreviewScene(value: SocketAttachment): void {
    this.#refreshPreviewInBackground('scene', async () => {
      await this.port.refreshSceneCache(value, true)
      const sceneId = this.port.cache()?.scene?.id
      if (sceneId) this.port.overlayDurableSceneCache(sceneId)
    })
  }

  /**
   * The Scene vision was built from Character revisions the authorization cache no longer holds
   * (D33). The cache reloads first; a Character that really changed rebuilds the Scene's vision.
   */
  #refreshPreviewVision(value: SocketAttachment): void {
    this.#refreshPreviewInBackground('scene', async () => {
      const authorization = await this.port.refreshAuthorization()
      if (!roomVisionCurrent(authorization, this.port.cache()?.characterRevisions ?? []))
        await this.port.refreshSceneCache(value, true)
    })
  }

  /**
   * Validates one sample against its stream and fans it out to each admitted recipient's projection.
   * It runs within the sample's message, so the admissions read by the caller are still current.
   */
  #sendTransient(
    origin: WebSocket,
    originAttachment: SocketAttachment,
    originAdmission: Admission,
    candidates: readonly { admission: Admission; socket: WebSocket }[],
    boundTokenControl: BoundTokenControl | null,
    assignments: LiveSessionRoomAuthorization['campaign']['assignments'],
    scene: CampaignSceneStateDto,
    envelope: SceneTransientEnvelopeDto
  ): void {
    const key = sceneTransientStreamKey(envelope)
    const streams = this.#previewStreams.get(origin) ?? new Map<string, PreviewStream>()
    const retained = streams.get(key)
    if ((retained?.sequence ?? -1) >= envelope.sequence) return
    const retain = (path: ScenePoint[] | null) => {
      streams.set(key, {
        baselineVersion: envelope.baselineVersion,
        path,
        sceneId: envelope.sceneId,
        sequence: envelope.sequence
      })
      this.#previewStreams.set(origin, streams)
    }
    const recipients = candidates.filter(
      (candidate) =>
        attachment(candidate.socket)?.socketId !== originAttachment.socketId &&
        (envelope.audience !== 'GM' || candidate.admission.role === 'OWNER')
    )
    if (envelope.kind === 'TOKEN_DRAG_PREVIEW') {
      if (envelope.previewUserId && originAdmission.role !== 'OWNER') return
      const token = scene.tokens.find((candidate) => candidate.id === envelope.tokenId)
      if (
        !token ||
        !canPreviewSceneTokenDrag({
          token,
          role: originAdmission.role,
          userId: originAdmission.userId,
          originBoundTokenControl: boundTokenControl,
          assignments
        })
      )
        return
      const currentPath =
        retained?.sceneId === envelope.sceneId &&
        retained.baselineVersion === envelope.baselineVersion
          ? (retained.path ?? [token.position])
          : [token.position]
      const nextPath =
        envelope.position.x < 0 ||
        envelope.position.y < 0 ||
        envelope.position.x > scene.map.width ||
        envelope.position.y > scene.map.height
          ? currentPath
          : extendSceneMovementPath(
              scene,
              currentPath,
              envelope.position,
              this.#movementIndex(scene)
            )
      const accepted =
        nextPath.at(-1)?.x === envelope.position.x && nextPath.at(-1)?.y === envelope.position.y
      retain(nextPath)
      if (!accepted)
        return send(origin, {
          message: {
            envelope,
            tokenDragResolution: { accepted: false, path: currentPath },
            userId: originAdmission.userId,
            visionLayers: []
          },
          type: 'TRANSIENT'
        })
      const controlledScene = withCharacterControllers(scene, assignments)
      const previewScene = {
        ...controlledScene,
        tokens: controlledScene.tokens.map((candidate) =>
          candidate.id === token.id ? { ...candidate, position: envelope.position } : candidate
        )
      }
      const originViewer =
        originAdmission.role === 'OWNER' && envelope.previewUserId
          ? { role: 'PLAYER' as const, userId: envelope.previewUserId }
          : viewer(originAdmission)
      if (!isSceneTokenVisibleToViewer(previewScene, originViewer, token.id)) return
      const originPreview = projectSceneTokenPreviewForViewer(previewScene, {
        path: nextPath,
        tokenId: token.id,
        viewer: originViewer
      })
      send(origin, {
        message: {
          envelope,
          tokenDragResolution: { accepted: true, path: nextPath },
          userId: originAdmission.userId,
          visionLayers: originPreview.visionLayers,
          visionReveal: originPreview.reveal
        },
        type: 'TRANSIENT'
      })
      for (const recipient of recipients) {
        const recipientViewer = viewer(recipient.admission)
        if (!isSceneTokenVisibleToViewer(previewScene, recipientViewer, token.id)) continue
        const preview = projectSceneTokenPreviewForViewer(previewScene, {
          path: nextPath,
          tokenId: token.id,
          viewer: recipientViewer
        })
        send(recipient.socket, {
          message: {
            envelope: { ...envelope, previewUserId: undefined },
            userId: originAdmission.userId,
            visionLayers: preview.visionLayers,
            visionReveal: preview.reveal
          },
          type: 'TRANSIENT'
        })
      }
      return
    }
    if (envelope.kind === 'PING') {
      const { x, y } = envelope.position
      if (x < 0 || y < 0 || x > scene.map.width || y > scene.map.height) return
      if (this.port.budget(origin)?.take('PING') !== true) return
      retain(null)
      for (const recipient of recipients) {
        // A GM ping follows the GM's preview audience; a player's ping shows only where it is seen.
        if (
          originAdmission.role === 'PLAYER' &&
          recipient.admission.role !== 'OWNER' &&
          !isScenePointExplored(scene, recipient.admission.userId, envelope.position)
        )
          continue
        send(recipient.socket, {
          message: { envelope, userId: originAdmission.userId },
          type: 'TRANSIENT'
        })
      }
      return
    }
    if (
      envelope.kind === 'FOG_AREA_PREVIEW' &&
      (originAdmission.role !== 'OWNER' ||
        sceneFogOwnerFailure(scene.fogMode, envelope.ownerUserId) !== null)
    )
      return
    retain(null)
    for (const recipient of recipients) {
      if (
        envelope.kind === 'FOG_AREA_PREVIEW' &&
        envelope.ownerUserId !== null &&
        recipient.admission.role !== 'OWNER' &&
        recipient.admission.userId !== envelope.ownerUserId
      )
        continue
      send(recipient.socket, {
        message: { envelope, userId: originAdmission.userId },
        type: 'TRANSIENT'
      })
    }
  }

  #movementIndex(scene: CampaignSceneStateDto): SceneBarrierIndex {
    const cached = this.#movementIndexes.get(scene.id)
    if (cached?.barriers === scene.barriers) return cached.index
    const index = new SceneBarrierIndex(scene.barriers)
    this.#movementIndexes.set(scene.id, { barriers: scene.barriers, index })
    return index
  }
}
