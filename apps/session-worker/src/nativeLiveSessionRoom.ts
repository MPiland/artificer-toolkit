import { DurableObject } from 'cloudflare:workers'
import {
  LIVE_SESSION_CONTROL_PATH,
  liveSessionControlInputSchema,
  liveSessionWebSocketClientMessageDtoSchema,
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionCommandRejectionCodeDto,
  type LiveSessionCorrectionDto,
  type LiveSessionPresentationControlInput,
  type LiveSessionWebSocketClientMessageDto,
  type LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import type { LiveSessionTransientCapture } from '@artificer-toolkit/schema/api/liveSessionTransient'
import {
  liveSessionPublishInputSchema,
  type LiveSessionScenePublicationDto
} from '@artificer-toolkit/schema/api/liveSessionState'
import type { LiveSessionMovementStage } from '@artificer-toolkit/schema/api/liveSessionMovementStage'
import type { SceneBaseOrdinals } from '@artificer-toolkit/schema/api/sceneGeometry'
import { DOMAIN_REJECTION_MESSAGES } from '@artificer-toolkit/schema/api/domainRejections'
import { LIVE_SESSION_TRY_AGAIN_MESSAGE } from '@artificer-toolkit/schema/api/liveSessionCommands'
import {
  sceneCommandResultDtoSchema,
  type BindEncounterToPresentedSceneInputDto,
  type BindEncounterToPresentedSceneResultDto,
  type CampaignSceneStateDto,
  type SceneCommandResultDto,
  type SceneTransientEnvelopeDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { checksumCanonicalJson, equalCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  applySceneDelta,
  extendSceneMovementPath,
  isSceneTokenVisibleToViewer,
  projectSceneDeltaForViewer,
  projectSceneForViewer,
  projectSceneTokenPreviewForViewer,
  SceneBarrierIndex,
  sceneFogOwnerFailure,
  type ScenePoint,
  type SceneViewer
} from '@artificer-toolkit/shared/vtt'
import type {
  EncounterCommandInputDto,
  EncounterCommandResultDto,
  ResolveRuleOccurrenceInputDto,
  VoidRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { decodeJwt } from 'jose'
import { z } from 'zod'

import { DurableCommandJournal } from './durableCommandJournal.js'
import type { SessionWorkerEnvironment } from './environment.js'
import {
  createNativeLiveSessionState,
  hydrateNativeLiveSessionState,
  projectNativeLiveSessionState
} from './nativeLiveSessionState.js'
import {
  canPreviewSceneTokenDrag,
  isExternalSceneCommand,
  liveSessionSceneCommandInputSchema,
  planLiveSceneCommand
} from './nativeRoomSceneCommand.js'
import {
  callLiveSessionRoute,
  LIVE_SESSION_ROUTE_TIMEOUT_MS,
  LiveSessionDomainRejectionError,
  LiveSessionRouteError
} from './liveSessionRoutes.js'
import {
  encounterCommandRefusal,
  executeLiveEncounterCommand,
  sceneNotPresentedRejection,
  type LiveEncounterActor
} from './nativeRoomEncounterCommand.js'
import { LiveCaptureCache, type LiveCaptureReads } from './nativeCaptureCache.js'
import {
  commitExternalSceneCommit,
  prepareExternalSceneCommit,
  stageExternalSceneCommand,
  type ExternalSceneCommand,
  type ExternalSceneContext
} from './nativeExternalSceneCommit.js'
import { createNativeLiveRulesRuntime, secureRandomInt } from './nativeRulesRuntime.js'
import { hydrateNativeTransientScene } from './nativeSceneClient.js'
import {
  exceedsMessageBytes,
  messageClass,
  PendingWork,
  ROOM_LIMITS,
  SocketMessageBudget
} from './roomLimits.js'
import { verifyLiveSessionTicket } from './ticket.js'

const INTERNAL_TICKET_HEADER = 'x-artificer-live-session-ticket'

const socketAttachmentSchema = z.strictObject({
  acceptedAt: z.number().int().positive(),
  authorityEpoch: z.string().uuid(),
  campaignId: z.string().uuid(),
  membershipEpoch: z.nullable(z.iso.datetime({ offset: true })),
  role: z.enum(['OWNER', 'PLAYER']),
  socketId: z.string().uuid(),
  ticketExpiresAt: z.number().int().positive(),
  userId: z.string().uuid()
})
type SocketAttachment = z.infer<typeof socketAttachmentSchema>

interface Admission {
  accessToken: string
  deadline: number
  generation: number
  membershipEpoch: string
  role: 'OWNER' | 'PLAYER'
  userId: string
}

/**
 * The room's shared Scene: every entity (never filtered for one member), each token's and
 * barrier's definition ordinal, the bound Encounter and whether it waits on a movement decision.
 */
interface TransientCache {
  baseOrdinals: SceneBaseOrdinals
  characterRevisions: LiveSessionTransientCapture['observedCharacterRevisions']
  encounterId: string | null
  key: string
  /** A pending movement decision holds moves and door changes on this Scene (D26). */
  movementDecisionPending: boolean
  scene: CampaignSceneStateDto | null
  presentation: LiveSessionScenePublicationDto['presentation'] | null
  synchronized: boolean
  /** When Convex last confirmed `characterRevisions` current (D33); previews trust it for a lease. */
  visionCheckedAt: number
}

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

/** A player's bound-token control on the Encounter-bound Scene (D25), leased for previews. */
interface PreviewControl {
  cacheGeneration: number
  checkedAt: number
  control: LiveSessionTransientCapture['originBoundTokenControl']
  encounterId: string | null
  membershipEpoch: string
  sceneId: string | null
}

interface NativeRoomIdentityRow extends Record<string, SqlStorageValue> {
  campaign_id: string
}

function attachment(socket: WebSocket): SocketAttachment | null {
  const parsed = socketAttachmentSchema.safeParse(socket.deserializeAttachment())
  return parsed.success ? parsed.data : null
}

function viewer(value: Pick<Admission, 'role' | 'userId'>): SceneViewer {
  return { role: value.role === 'OWNER' ? 'GM' : 'PLAYER', userId: value.userId }
}

/** The admitted member a private Encounter or Scene route acts for; Convex rechecks every field. */
function liveActor(admission: Admission, value: SocketAttachment): LiveEncounterActor {
  return {
    campaignId: value.campaignId,
    authorityEpoch: value.authorityEpoch,
    expectedUserId: admission.userId,
    expectedRole: admission.role
  }
}

function send(socket: WebSocket, message: LiveSessionWebSocketServerMessageDto): void {
  if (socket.readyState !== WebSocket.OPEN) return
  socket.send(JSON.stringify(liveSessionWebSocketServerMessageDtoSchema.parse(message)))
}

/**
 * A stored command receipt sent again for an exact retry. Its Scene or binding result reports
 * `replayed: true`, as Convex's replays do; an Encounter result has no replay flag.
 */
function replayReceipt(receiptJson: string): LiveSessionWebSocketServerMessageDto {
  const receipt = liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(receiptJson))
  if (receipt.type !== 'COMMAND_COMMITTED')
    throw new Error('Live Session command receipt is invalid.')
  const { delta } = receipt
  if (delta?.scope === 'SCENE')
    return { ...receipt, delta: { ...delta, result: { ...delta.result, replayed: true } } }
  if (delta?.scope === 'ENCOUNTER_BINDING')
    return { ...receipt, delta: { ...delta, result: { ...delta.result, replayed: true } } }
  return receipt
}

function streamKey(envelope: SceneTransientEnvelopeDto): string {
  if (envelope.kind === 'TOKEN_DRAG_PREVIEW') return `${envelope.kind}:${envelope.tokenId}`
  if (envelope.kind === 'FOG_AREA_PREVIEW')
    return `${envelope.kind}:${envelope.ownerUserId ?? 'SHARED_PARTY'}`
  return envelope.kind
}

function cacheKey(capture: LiveSessionTransientCapture): string {
  return JSON.stringify({
    campaignId: capture.campaignId,
    origin: capture.origin,
    presentation: capture.presentation,
    sceneEncounterId: capture.sceneEncounterId,
    sceneMovementDecisionPending: capture.sceneMovementDecisionPending,
    originBoundTokenControl: capture.originBoundTokenControl,
    sceneHeader: capture.sceneHeader,
    systemId: capture.systemId,
    visionFreshness: capture.visionFreshness,
    observedCharacterRevisions: capture.observedCharacterRevisions
  })
}

function authorityFingerprint(capture: LiveSessionTransientCapture): unknown {
  return {
    campaignId: capture.campaignId,
    origin: capture.origin,
    presentation: capture.presentation,
    recipients: [...capture.recipients].sort((left, right) =>
      left.userId.localeCompare(right.userId)
    ),
    sceneEncounterId: capture.sceneEncounterId,
    sceneMovementDecisionPending: capture.sceneMovementDecisionPending,
    sceneHeader: capture.sceneHeader,
    systemId: capture.systemId,
    visionFreshness: capture.visionFreshness
  }
}

export class NativeLiveSessionRoom extends DurableObject<SessionWorkerEnvironment> {
  readonly #journal: DurableCommandJournal
  readonly #admissions = new Map<WebSocket, Admission>()
  readonly #authenticating = new Map<
    WebSocket,
    { accessToken: string; deadline: number; generation: number }
  >()
  readonly #generations = new Map<WebSocket, number>()
  readonly #movementIndexes = new Map<
    string,
    { barriers: CampaignSceneStateDto['barriers']; index: SceneBarrierIndex }
  >()
  #activation: Promise<void> | null = null
  readonly #previewStreams = new Map<WebSocket, Map<string, PreviewStream>>()
  /** Keyed by user ID. */
  readonly #previewControls = new Map<string, PreviewControl>()
  /** Background preview refreshes by input: at most one running and one start per retry window. */
  readonly #previewRefreshes = new Map<string, { running: boolean; startedAt: number }>()
  readonly #budgets = new Map<WebSocket, SocketMessageBudget>()
  readonly #pendingCommands = new PendingWork(
    ROOM_LIMITS.maxPendingCommandsPerSocket,
    ROOM_LIMITS.maxPendingCommandsPerRoom
  )
  /** Players with an Encounter command queued or running; see `roomLimits.ts`. */
  readonly #playerEncounterCommands = new Map<string, number>()
  #cache: TransientCache | null = null
  readonly #captureCache = new LiveCaptureCache()
  #cacheGeneration = 0
  #presentationChanging = false
  #commandChain: Promise<void> = Promise.resolve()
  #outboxFlush: Promise<void> | null = null
  #rulesRuntime: Promise<RulesRuntimeService> | null = null
  #sceneSync: Promise<void> | null = null

  constructor(ctx: DurableObjectState, env: SessionWorkerEnvironment) {
    super(ctx, env)
    this.#journal = new DurableCommandJournal(ctx.storage)
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS native_room_identity (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          campaign_id TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS used_tickets (
          jti TEXT PRIMARY KEY,
          expires_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS room_idle_release (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          release_at INTEGER NOT NULL
        );
      `)
    })
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'POST' && url.pathname === LIVE_SESSION_CONTROL_PATH) {
      const parsed = liveSessionControlInputSchema.safeParse(await request.json().catch(() => null))
      if (!parsed.success)
        return new Response('Invalid live-session control request.', { status: 400 })
      const roomCampaignId = this.#roomCampaignId()
      if (roomCampaignId && roomCampaignId !== parsed.data.campaignId)
        return new Response('Live-session room identity does not match.', { status: 409 })
      if (parsed.data.operation.type === 'EVICT_USER') {
        const closed = this.#closeSockets(parsed.data.operation)
        await this.#refreshIdleRelease()
        return Response.json({ closed })
      }
      if (parsed.data.operation.type === 'SET_SCENE_PRESENTATION') {
        const input = { ...parsed.data, operation: parsed.data.operation }
        const next = this.#commandChain.then(() => this.#presentScene(input))
        this.#commandChain = next.then(
          () => undefined,
          () => undefined
        )
        try {
          return Response.json(await next)
        } catch {
          return new Response('Live Scene presentation is unavailable.', { status: 409 })
        }
      }
      return Response.json({ closed: await this.#closeRoom(parsed.data.campaignId) })
    }
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket')
      return new Response('Expected a WebSocket upgrade.', { status: 426 })
    const ticket = request.headers.get(INTERNAL_TICKET_HEADER)
    if (!ticket) return new Response('Live-session ticket is missing.', { status: 401 })

    let claims: Awaited<ReturnType<typeof verifyLiveSessionTicket>>
    try {
      claims = await verifyLiveSessionTicket(ticket, this.env.LIVE_SESSION_TICKET_SECRET)
    } catch {
      return new Response('Live-session ticket is invalid.', { status: 401 })
    }
    const roomCampaignId = this.#roomCampaignId()
    if (roomCampaignId && roomCampaignId !== claims.campaignId)
      return new Response('Live-session room identity does not match.', { status: 403 })
    if (!roomCampaignId)
      this.ctx.storage.sql.exec(
        'INSERT INTO native_room_identity (id, campaign_id) VALUES (1, ?)',
        claims.campaignId
      )
    // Refusing (rather than replacing an older socket) cannot make a user's tabs evict each other
    // in a reconnect loop. Both checks precede ticket use, so a refused attempt consumes nothing.
    if (this.ctx.getWebSockets(claims.sub).length >= ROOM_LIMITS.maxSocketsPerUser)
      return new Response('Too many live-session connections for this user.', { status: 429 })
    if (this.ctx.getWebSockets().length >= ROOM_LIMITS.maxSocketsPerRoom)
      return new Response('Live-session room is full.', { status: 503 })
    const nowSeconds = Math.floor(Date.now() / 1_000)
    this.ctx.storage.sql.exec('DELETE FROM used_tickets WHERE expires_at <= ?', nowSeconds)
    try {
      this.ctx.storage.sql.exec(
        'INSERT INTO used_tickets (jti, expires_at) VALUES (?, ?)',
        claims.jti,
        claims.exp
      )
    } catch {
      return new Response('Live-session ticket was already used.', { status: 409 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    const acceptedAt = Date.now()
    server.serializeAttachment({
      acceptedAt,
      authorityEpoch: claims.authorityEpoch,
      campaignId: claims.campaignId,
      membershipEpoch: null,
      role: claims.role,
      socketId: crypto.randomUUID(),
      ticketExpiresAt: claims.exp,
      userId: claims.sub
    } satisfies SocketAttachment)
    this.ctx.acceptWebSocket(server, [claims.sub])
    await this.#scheduleAlarm()
    return new Response(null, {
      headers: { 'sec-websocket-protocol': 'artificer.live-session.v1' },
      status: 101,
      webSocket: client
    })
  }

  async webSocketMessage(socket: WebSocket, rawMessage: string | ArrayBuffer): Promise<void> {
    if (typeof rawMessage !== 'string' || exceedsMessageBytes(rawMessage)) {
      this.#closeSocket(socket, 'Invalid live-session message.')
      return
    }
    const parsed = liveSessionWebSocketClientMessageDtoSchema.safeParse(this.#json(rawMessage))
    let budget = this.#budgets.get(socket)
    if (!budget) {
      budget = new SocketMessageBudget()
      this.#budgets.set(socket, budget)
    }
    if (!budget.take(messageClass(parsed.success ? parsed.data : null))) {
      this.#closeSocket(socket, 'Too many live-session messages.')
      return
    }
    if (!parsed.success) {
      this.#challenge(socket)
      return
    }
    if (parsed.data.type === 'AUTHENTICATE') {
      await this.#authenticate(socket, parsed.data.accessToken)
      return
    }
    const admission = this.#liveAdmission(socket)

    if (!admission) {
      this.#challenge(socket)
      return
    }
    if (parsed.data.type === 'RESUME') {
      this.#sendStateSync(socket, admission)
      return
    }
    if (parsed.data.type === 'COMMAND') {
      const work = { admission, message: parsed.data }
      const commandId = work.message.command.command.commandId
      // A player may have one Encounter or Convex-first command in flight; the GM's are bounded
      // per socket only.
      const playerEncounter =
        admission.role === 'PLAYER' &&
        (work.message.command.scope === 'ENCOUNTER' ||
          this.#isExternalCommand(work.message.command.command))
          ? admission.userId
          : null
      if (
        playerEncounter !== null &&
        (this.#playerEncounterCommands.get(playerEncounter) ?? 0) >=
          ROOM_LIMITS.maxInFlightEncounterCommandsPerPlayer
      ) {
        this.#rejectCommand(
          socket,
          commandId,
          'UNAVAILABLE',
          'Your previous action is still resolving.'
        )
        return
      }
      if (!this.#pendingCommands.tryAcquire(socket)) {
        this.#rejectCommand(socket, commandId, 'UNAVAILABLE', 'Too many pending table changes.')
        return
      }
      if (playerEncounter !== null)
        this.#playerEncounterCommands.set(
          playerEncounter,
          (this.#playerEncounterCommands.get(playerEncounter) ?? 0) + 1
        )
      const next = this.#commandChain
        .then(() => this.#executeCommand(socket, work.admission, work.message))
        .catch(() =>
          this.#rejectCommand(socket, commandId, 'UNAVAILABLE', 'Live Session command unavailable.')
        )
        .finally(() => {
          this.#pendingCommands.release(socket)
          if (playerEncounter === null) return
          const count = (this.#playerEncounterCommands.get(playerEncounter) ?? 1) - 1
          if (count > 0) this.#playerEncounterCommands.set(playerEncounter, count)
          else this.#playerEncounterCommands.delete(playerEncounter)
        })
      this.#commandChain = next
      await next
      return
    }
    if (parsed.data.type === 'SYNCHRONIZE_SCENE') {
      const message = parsed.data
      const next = this.#commandChain.then(() =>
        this.#synchronizeScene(
          socket,
          message.sceneId,
          message.version,
          message.expectedPresentationVersion
        )
      )
      this.#commandChain = next.catch(() => this.#challenge(socket, admission.generation))
      await this.#commandChain
      return
    }
    try {
      this.#broadcastTransient(socket, admission, parsed.data.envelope)
    } catch {
      this.#cache = null
      this.#challenge(socket, admission.generation)
    }
  }

  async webSocketClose(socket: WebSocket): Promise<void> {
    this.#forgetSocket(socket)
    await this.#refreshIdleRelease(socket)
  }

  async webSocketError(socket: WebSocket): Promise<void> {
    this.#forgetSocket(socket)
    await this.#refreshIdleRelease(socket)
  }

  /**
   * Closes sockets that have not authenticated within the admission window, and drains and releases
   * authority once the room has had no admitted socket for the idle window.
   */
  async alarm(): Promise<void> {
    const now = Date.now()
    for (const socket of this.#openSockets()) {
      const value = attachment(socket)
      if (!value || value.membershipEpoch !== null || this.#admissions.has(socket)) continue
      if (value.acceptedAt + ROOM_LIMITS.authenticationTimeoutMs <= now)
        this.#closeSocket(socket, 'Live-session authentication timed out.')
    }
    const releaseAt = this.#idleReleaseAt()
    const campaignId = this.#roomCampaignId()
    // A socket still inside its admission window may be a reconnect, so release waits for it.
    if (releaseAt !== null && releaseAt <= now && campaignId && this.#openSockets().length === 0)
      await this.#closeRoom(campaignId)
    await this.#refreshIdleRelease()
  }

  /**
   * Starts the idle-release window when the last admitted socket leaves an active room; an admitted
   * socket cancels it. `leaving` is a socket the runtime may still list while it closes.
   */
  async #refreshIdleRelease(leaving?: WebSocket): Promise<void> {
    if (this.#openSockets(leaving).some((socket) => attachment(socket)?.membershipEpoch))
      this.ctx.storage.sql.exec('DELETE FROM room_idle_release WHERE id = 1')
    else if (this.#journal.readCurrent()?.status === 'ACTIVE')
      this.ctx.storage.sql.exec(
        'INSERT OR IGNORE INTO room_idle_release (id, release_at) VALUES (1, ?)',
        Date.now() + ROOM_LIMITS.idleReleaseMs
      )
    await this.#scheduleAlarm(leaving)
  }

  /** The room's one alarm serves every pending admission window and the idle release. */
  async #scheduleAlarm(leaving?: WebSocket): Promise<void> {
    const open = this.#openSockets(leaving)
    const deadlines = open.flatMap((socket) => {
      const value = attachment(socket)
      return value && value.membershipEpoch === null && !this.#admissions.has(socket)
        ? [value.acceptedAt + ROOM_LIMITS.authenticationTimeoutMs]
        : []
    })
    const releaseAt = this.#idleReleaseAt()
    if (releaseAt !== null && open.length === 0) deadlines.push(releaseAt)
    if (deadlines.length === 0) await this.ctx.storage.deleteAlarm()
    else await this.ctx.storage.setAlarm(Math.min(...deadlines))
  }

  #idleReleaseAt(): number | null {
    return (
      this.ctx.storage.sql
        .exec<{ release_at: number }>('SELECT release_at FROM room_idle_release WHERE id = 1')
        .toArray()[0]?.release_at ?? null
    )
  }

  #openSockets(except?: WebSocket): WebSocket[] {
    return this.ctx
      .getWebSockets()
      .filter((socket) => socket !== except && socket.readyState === WebSocket.OPEN)
  }

  async #authenticate(socket: WebSocket, accessToken: string): Promise<void> {
    const value = attachment(socket)
    if (!value) {
      socket.close(1008, 'Invalid live-session socket.')
      return
    }
    const pending = this.#authenticating.get(socket)
    if (
      pending?.accessToken === accessToken &&
      pending.generation === this.#generations.get(socket)
    )
      return
    const generation = this.#invalidate(socket)
    if (this.#presentationChanging) return
    const cacheGeneration = this.#cacheGeneration
    let expiration: number
    try {
      const exp = decodeJwt(accessToken).exp
      if (typeof exp !== 'number' || !Number.isFinite(exp) || exp <= 0 || exp * 1_000 <= Date.now())
        throw new Error('Invalid token expiry.')
      expiration = exp
    } catch {
      this.#challenge(socket, generation)
      return
    }
    if (value.membershipEpoch === null && Date.now() >= value.ticketExpiresAt * 1_000) {
      this.#closeIfCurrent(socket, generation, 'Live-session ticket expired.')
      return
    }
    const deadline = expiration * 1_000
    this.#authenticating.set(socket, { accessToken, deadline, generation })
    try {
      const capture = await callLiveSessionRoute(this.env, accessToken, 'capture', {
        campaignId: value.campaignId,
        expectedRole: value.role,
        expectedUserId: value.userId,
        mode: 'AUTHORITY',
        observedCharacterRevisions: [],
        recipientUserIds: this.#recipientUserIds()
      })
      if (
        capture.origin.userId !== value.userId ||
        capture.origin.role !== value.role ||
        (value.membershipEpoch !== null && capture.origin.membershipEpoch !== value.membershipEpoch)
      ) {
        this.#closeIfCurrent(socket, generation, 'Live-session membership changed.')
        return
      }
      if (capture.campaignId !== value.campaignId) {
        this.#challenge(socket, generation)
        return
      }
      await this.#ensureAuthority(value, accessToken, capture.origin.role, capture.origin.userId)
      if (generation !== this.#generations.get(socket)) return
      if (this.#presentationChanging || cacheGeneration !== this.#cacheGeneration) {
        this.#challenge(socket, generation)
        return
      }
      if (this.#cache?.scene) {
        if (
          capture.sceneEncounterId !== this.#cache.encounterId ||
          capture.sceneHeader?.id !== this.#cache.scene.id ||
          capture.sceneHeader.version !== this.#cache.scene.version ||
          capture.presentation?.sceneId !== this.#cache.scene.id
        )
          this.#cache = null
        else
          this.#cache = {
            ...this.#cache,
            movementDecisionPending: capture.sceneMovementDecisionPending,
            presentation: { expectedPresentationVersion: capture.presentation.version }
          }
      }
      const admitted: Admission = {
        accessToken,
        deadline,
        generation,
        membershipEpoch: capture.origin.membershipEpoch,
        role: capture.origin.role,
        userId: capture.origin.userId
      }
      if (
        Date.now() >= admitted.deadline ||
        generation !== this.#generations.get(socket) ||
        (value.membershipEpoch === null && Date.now() >= value.ticketExpiresAt * 1_000)
      ) {
        if (value.membershipEpoch === null && Date.now() >= value.ticketExpiresAt * 1_000) {
          this.#closeIfCurrent(socket, generation, 'Live-session ticket expired.')
          return
        }
        this.#challenge(socket, generation)
        return
      }
      const latest = attachment(socket)
      if (
        !latest ||
        (latest.membershipEpoch !== null && latest.membershipEpoch !== admitted.membershipEpoch)
      ) {
        this.#challenge(socket, generation)
        return
      }
      if (latest.membershipEpoch === null)
        socket.serializeAttachment({ ...latest, membershipEpoch: admitted.membershipEpoch })
      if (socket.readyState !== WebSocket.OPEN || this.#generations.get(socket) !== generation)
        return
      this.#admissions.set(socket, admitted)
      const current = this.#liveAdmission(socket)
      if (
        current?.generation === admitted.generation &&
        current.role === admitted.role &&
        current.membershipEpoch === admitted.membershipEpoch
      ) {
        send(socket, {
          campaignId: value.campaignId,
          type: 'TRANSIENT_READY'
        })
        this.#sendStateSync(socket, current)
        this.#publishInBackground()
        // A reconnect inside the idle window cancels the pending release.
        await this.#refreshIdleRelease()
      }
    } catch (error) {
      if (
        error instanceof LiveSessionRouteError &&
        (error.status === 401 || error.status === 409)
      ) {
        this.#closeIfCurrent(socket, generation, 'Live-session membership changed.')
        return
      }
      this.#challenge(socket, generation)
    } finally {
      if (this.#authenticating.get(socket)?.generation === generation)
        this.#authenticating.delete(socket)
    }
  }

  async #ensureAuthority(
    value: SocketAttachment,
    accessToken: string,
    role: 'OWNER' | 'PLAYER',
    userId: string
  ): Promise<void> {
    if (!this.#activation) {
      const work = (async () => {
        const bootstrap = await callLiveSessionRoute(this.env, accessToken, 'bootstrap', {
          authorityEpoch: value.authorityEpoch,
          campaignId: value.campaignId,
          expectedRole: role,
          expectedUserId: userId
        })
        let current = this.#journal.readCurrent()
        if (
          current &&
          current.authorityEpoch !== value.authorityEpoch &&
          bootstrap.persistedSequence === 0
        ) {
          // Convex verified the replacement epoch; a never-used or released journal can be rebuilt.
          this.#journal.discardReplaceableAuthority(current.authorityEpoch)
          current = null
          this.#cache = null
        }
        // Convex may already hold an unsettled Convex-first commit at the next sequence.
        if (current?.authorityEpoch === value.authorityEpoch) {
          await this.#settleExternalCommit()
          current = this.#journal.readCurrent()
        }
        if (!current) {
          if (bootstrap.persistedSequence !== 0)
            throw new Error('Live Session bootstrap sequence is unavailable.')
          const initial = createNativeLiveSessionState()
          current = this.#journal.activate({
            authorityEpoch: value.authorityEpoch,
            snapshotChecksum: initial.stateChecksum,
            stateJson: initial.stateJson
          })
        }
        if (current.authorityEpoch !== value.authorityEpoch || current.status !== 'ACTIVE')
          throw new Error('Live Session authority changed.')
        if (
          bootstrap.persistedSequence < current.publishedSequence ||
          bootstrap.persistedSequence > current.sequence
        )
          throw new Error('Live Session publication state is inconsistent.')
        while (current.publishedSequence < bootstrap.persistedSequence) {
          const acknowledged = this.#journal
            .listPending(100)
            .filter((entry) => entry.sequence <= bootstrap.persistedSequence)
            .at(-1)
          if (!acknowledged) throw new Error('Live Session publication recovery is incomplete.')
          current = this.#journal.acknowledge({
            authorityEpoch: value.authorityEpoch,
            stateChecksum: acknowledged.stateChecksum,
            throughSequence: acknowledged.sequence
          })
        }
        if (current.sequence === 0) {
          const activated = await callLiveSessionRoute(this.env, null, 'activate', {
            activationFingerprint: bootstrap.activationFingerprint,
            campaignId: value.campaignId,
            epoch: value.authorityEpoch,
            stateChecksum: current.stateChecksum
          })
          if (
            activated.phase !== 'DO_ACTIVE' ||
            activated.persistedSequence !== 0 ||
            activated.persistedStateChecksum !== current.stateChecksum
          )
            throw new Error('Live Session activation did not commit.')
        } else if (
          current.publishedSequence !== bootstrap.persistedSequence ||
          current.publishedChecksum !== bootstrap.persistedStateChecksum
        )
          throw new Error('Live Session publication checksum is inconsistent.')
        await this.#flushOutbox()
      })()
      this.#activation = work
      void work.catch(() => {
        if (this.#activation === work) this.#activation = null
      })
    }
    await this.#activation
    const current = this.#journal.readCurrent()
    if (!current || current.authorityEpoch !== value.authorityEpoch || current.status !== 'ACTIVE')
      throw new Error('Live Session authority changed.')
  }

  #sendStateSync(socket: WebSocket, admission: Admission): void {
    const value = attachment(socket)
    const current = this.#journal.readCurrent()
    if (
      !value ||
      !current ||
      current.authorityEpoch !== value.authorityEpoch ||
      this.#liveAdmission(socket)?.generation !== admission.generation
    )
      return this.#challenge(socket, admission.generation)
    send(socket, {
      authorityEpoch: current.authorityEpoch,
      sequence: current.sequence,
      state: projectNativeLiveSessionState(
        {
          scene: this.#cache?.synchronized ? this.#cache.scene : null
        },
        admission
      ),
      type: 'STATE_SYNC'
    })
  }

  async #executeCommand(
    socket: WebSocket,
    admission: Admission,
    message: Extract<LiveSessionWebSocketClientMessageDto, { type: 'COMMAND' }>
  ): Promise<void> {
    if (this.#liveAdmission(socket)?.generation !== admission.generation) return
    const value = attachment(socket)
    const current = this.#journal.readCurrent()
    const commandId = message.command.command.commandId
    if (!value || !current || current.authorityEpoch !== value.authorityEpoch) {
      this.#rejectCommand(socket, commandId, 'AUTHORITY_CHANGED', 'Live Session authority changed.')
      return
    }
    try {
      await this.#settleExternalCommit()
    } catch {
      this.#rejectCommand(
        socket,
        commandId,
        'UNAVAILABLE',
        'An earlier table change is still saving; try again.'
      )
      return
    }
    if (this.#liveAdmission(socket)?.generation !== admission.generation) return
    if (message.command.scope === 'ENCOUNTER')
      return this.#executeEncounterCommand(socket, admission, value, message.command.command)
    if (message.command.scope === 'ENCOUNTER_BINDING')
      return this.#executeEncounterBinding(socket, admission, value, message.command.command)
    const sceneCommand =
      message.command.scope === 'SCENE'
        ? liveSessionSceneCommandInputSchema.safeParse(message.command.command)
        : null
    if (!sceneCommand?.success) {
      this.#rejectCommand(
        socket,
        commandId,
        'UNAVAILABLE',
        'This command is not available through live play yet.',
        current.sequence
      )
      return
    }
    const fingerprint = checksumCanonicalJson({
      command: message.command,
      expectedSessionSequence: message.expectedSessionSequence
    })
    const prior = this.#journal.lookupCommand({
      actorId: admission.userId,
      commandId,
      fingerprint
    })
    if (prior.kind === 'MISMATCHED_REUSE') {
      this.#rejectCommand(
        socket,
        commandId,
        'INVALID_COMMAND',
        'The command ID was already used for different input.',
        current.sequence
      )
      return
    }
    if (prior.kind === 'REPLAY') {
      send(socket, replayReceipt(prior.receipt.receiptJson))
      return
    }
    const command = sceneCommand.data
    const synchronized = this.#cache?.synchronized ? this.#cache : null
    const scene = synchronized?.scene ?? null
    const correction = (): LiveSessionCorrectionDto | undefined =>
      scene ? { scope: 'SCENE', state: projectSceneForViewer(scene, viewer(admission)) } : undefined
    if (message.expectedSessionSequence !== current.sequence) {
      this.#rejectCommand(
        socket,
        commandId,
        'STALE_SEQUENCE',
        'Live Session changed; the current Scene has been restored.',
        current.sequence,
        correction()
      )
      return
    }
    if (!scene || scene.id !== command.sceneId || scene.version !== command.expectedSceneVersion) {
      this.#rejectCommand(
        socket,
        commandId,
        'STALE_STATE',
        'Scene changed; the current state has been restored.',
        current.sequence,
        correction()
      )
      return
    }
    if (
      !synchronized?.scene ||
      !synchronized.presentation ||
      synchronized.scene.id !== scene.id ||
      synchronized.scene.version !== scene.version
    ) {
      this.#rejectCommand(
        socket,
        commandId,
        'UNAVAILABLE',
        'Scene synchronization is required before changing the live Scene.',
        current.sequence,
        correction()
      )
      return
    }

    const plan = planLiveSceneCommand({
      actor: admission,
      command,
      encounterId: synchronized.encounterId,
      latestUnmatchedMove: () => this.#journal.latestUnmatchedSceneTokenMove(scene.id),
      movementDecisionPending: synchronized.movementDecisionPending,
      scene
    })
    if (plan.kind === 'REJECTED') {
      this.#rejectCommand(
        socket,
        commandId,
        plan.code,
        plan.message,
        current.sequence,
        plan.correct ? correction() : undefined
      )
      return
    }
    if (plan.kind === 'EXTERNAL') {
      if (command.type !== 'MOVE_SCENE_TOKEN' && command.type !== 'SET_SCENE_DOOR_STATE')
        throw new Error('Only token moves and door changes commit to Convex first.')
      try {
        await this.#commitExternal(
          socket,
          admission,
          value,
          command,
          fingerprint,
          this.#captureCache.reads()
        )
      } catch (error) {
        this.#rejectExternal(socket, commandId, error, correction())
      }
      return
    }
    const { delta } = plan

    const occurredAt = new Date().toISOString()
    let nextScene: CampaignSceneStateDto
    try {
      nextScene = applySceneDelta(scene, delta, scene.version + 1)
    } catch (error) {
      this.#rejectCommand(
        socket,
        commandId,
        'INVALID_COMMAND',
        error instanceof Error ? error.message : 'Scene command is invalid.',
        current.sequence,
        correction()
      )
      return
    }
    const next = createNativeLiveSessionState(nextScene)
    const expectedSceneResult = sceneCommandResultDtoSchema.parse({
      commandId,
      delta,
      occurrence: null,
      replayed: false,
      sceneId: scene.id,
      version: nextScene.version
    })
    const committed = liveSessionWebSocketServerMessageDtoSchema.parse({
      commandId,
      delta: { scope: 'SCENE', result: expectedSceneResult },
      sequence: current.sequence + 1,
      type: 'COMMAND_COMMITTED'
    })
    if (committed.type !== 'COMMAND_COMMITTED' || committed.delta?.scope !== 'SCENE')
      throw new Error('Live Session Scene command receipt is invalid.')
    const publication = liveSessionPublishInputSchema.parse({
      actorUserId: admission.userId,
      actorRole: admission.role,
      campaignId: value.campaignId,
      command: {
        command,
        scope: 'SCENE',
        presentation: synchronized.presentation
      },
      epoch: value.authorityEpoch,
      expectedSceneResult,
      expectedStateChecksum: current.stateChecksum,
      occurredAt,
      receiptId: commandId,
      sequence: committed.sequence,
      stateChecksum: next.stateChecksum
    })
    const result = this.#journal.commit({
      actorId: admission.userId,
      authorityEpoch: value.authorityEpoch,
      commandId,
      expectedSequence: current.sequence,
      expectedStateChecksum: current.stateChecksum,
      fingerprint,
      nextStateChecksum: next.stateChecksum,
      nextStateJson: next.stateJson,
      outboxPayloadJson: JSON.stringify(publication),
      receiptJson: JSON.stringify(committed),
      ...(command.type === 'MOVE_SCENE_TOKEN'
        ? {
            undoJson: JSON.stringify({
              id: scene.id,
              version: scene.version,
              tokens: scene.tokens
                .filter((token) => token.id === command.tokenId)
                .map(({ id, position }) => ({ id, position }))
            })
          }
        : {})
    })
    if (result.kind === 'REPLAY') {
      send(socket, replayReceipt(result.receipt.receiptJson))
      return
    }
    this.#cache = { ...synchronized, scene: nextScene, synchronized: true }
    this.#broadcastSceneCommitted(committed, scene, nextScene, expectedSceneResult, null)
    this.#publishInBackground()
    return
  }

  /**
   * Encounter rules read Scene state from Convex, so earlier Scene commands publish first. Success is
   * acknowledged only after Convex commits; a retry reuses the command ID and replays the receipt.
   */
  async #executeEncounterCommand(
    socket: WebSocket,
    admission: Admission,
    value: SocketAttachment,
    command: EncounterCommandInputDto
  ): Promise<void> {
    // A movement decision the room committed is journaled; its session sequence is not fenced (D28).
    const fingerprint = checksumCanonicalJson({ command, scope: 'ENCOUNTER' })
    const prior = this.#journal.lookupCommand({
      actorId: admission.userId,
      commandId: command.commandId,
      fingerprint
    })
    if (prior.kind === 'MISMATCHED_REUSE') {
      this.#rejectCommand(
        socket,
        command.commandId,
        'INVALID_COMMAND',
        'The command ID was already used for different input.'
      )
      return
    }
    if (prior.kind === 'REPLAY') {
      const replay = liveSessionWebSocketServerMessageDtoSchema.parse(
        JSON.parse(prior.receipt.receiptJson)
      )
      // A commit recovered after a restart kept only its Scene receipt.
      if (replay.type === 'COMMAND_COMMITTED' && replay.delta?.scope === 'ENCOUNTER')
        send(socket, replay)
      else
        this.#rejectCommand(
          socket,
          command.commandId,
          'STALE_STATE',
          'This decision was already settled.'
        )
      return
    }
    try {
      await this.#flushOutbox()
    } catch {
      this.#rejectCommand(
        socket,
        command.commandId,
        'UNAVAILABLE',
        'Earlier table changes are still saving; try again.'
      )
      return
    }
    let result: EncounterCommandResultDto
    let movementCommitted = false
    try {
      result = await executeLiveEncounterCommand({
        environment: this.env,
        accessToken: admission.accessToken,
        actor: liveActor(admission, value),
        command,
        runtime: await this.#liveRulesRuntime(),
        random: secureRandomInt,
        captureCache: this.#captureCache,
        stageHeldMovement: async (decision, captures) => {
          const context = this.#externalSceneContext()
          // Only a decision on the presented Scene's Encounter while it holds a movement decision.
          if (
            !context?.movementDecisionPending ||
            context.encounterId !== decision.encounterId.toLowerCase()
          )
            return null
          return stageExternalSceneCommand({
            environment: this.env,
            accessToken: admission.accessToken,
            actor: liveActor(admission, value),
            command: decision,
            context,
            captures
          })
        },
        movement: async (decision, captures, staged) => {
          movementCommitted = true
          return this.#commitMovementDecision(
            socket,
            admission,
            value,
            decision,
            fingerprint,
            captures,
            staged
          )
        }
      })
    } catch (error) {
      // Expected domain rejections carry a user-safe message; everything else stays generic.
      if (error instanceof LiveSessionDomainRejectionError) {
        send(socket, {
          code: 'DOMAIN_REJECTED',
          commandId: command.commandId,
          currentSequence: this.#journal.readCurrent()?.sequence ?? 0,
          message: error.rejection.message,
          reason: error.rejection.reason,
          warnings: error.rejection.reason === 'RULE_WARNINGS' ? error.rejection.warnings : null,
          type: 'COMMAND_REJECTED'
        })
        return
      }
      const refusal = encounterCommandRefusal(error)
      this.#rejectCommand(socket, command.commandId, refusal.code, refusal.message)
      return
    }
    // Only the room's own movement commits settle a held Scene's decision without a new read.
    if (!movementCommitted && command.type !== 'ROLL_RULE_EVIDENCE')
      await this.#refreshMovementHold(socket, admission, value).catch(() => undefined)
    // A member removed while the command ran must not receive its result.
    if (this.#liveAdmission(socket)?.generation !== admission.generation) return
    send(socket, {
      commandId: command.commandId,
      delta: { scope: 'ENCOUNTER', result },
      sequence: this.#journal.readCurrent()?.sequence ?? 0,
      type: 'COMMAND_COMMITTED'
    })
  }

  /**
   * A movement decision's answer or GM void commits through the room with its presented Scene
   * (D27); a decision off the presented Scene is refused (D42).
   */
  async #commitMovementDecision(
    socket: WebSocket,
    admission: Admission,
    value: SocketAttachment,
    command: ResolveRuleOccurrenceInputDto | VoidRuleOccurrenceInputDto,
    fingerprint: string,
    captures: LiveCaptureReads | undefined,
    staged: LiveSessionMovementStage | undefined
  ): Promise<EncounterCommandResultDto> {
    if (this.#cache?.synchronized && this.#cache.encounterId !== command.encounterId.toLowerCase())
      throw sceneNotPresentedRejection()
    const { encounter } = await this.#commitExternal(
      socket,
      admission,
      value,
      command,
      fingerprint,
      captures,
      staged
    )
    if (!encounter) throw new Error('A movement decision commit returned no Encounter result.')
    return encounter
  }

  /**
   * Runs one Convex-first command (D27) inside the command chain: publish earlier commands, stage
   * and prepare it, write the write-ahead record, then commit, which advances Convex's authority
   * to the next sequence in the same transaction. The room applies it only after Convex commits:
   * the Scene delta goes to every member (the decision summary only to its initiator), fog changes
   * resynchronize everyone, and a refusal leaves the room unchanged. A commit whose outcome the
   * room did not see keeps its record for the next command to settle.
   */
  async #commitExternal(
    socket: WebSocket,
    admission: Admission,
    value: SocketAttachment,
    command: ExternalSceneCommand,
    fingerprint: string,
    captures: LiveCaptureReads | undefined,
    staged?: LiveSessionMovementStage
  ) {
    await this.#flushOutbox()
    const context = this.#externalSceneContext()
    if (!context) throw new LiveSessionRouteError(409)
    const before = context.scene
    const actor = liveActor(admission, value)
    const prepared = await prepareExternalSceneCommit({
      environment: this.env,
      accessToken: admission.accessToken,
      actor,
      command,
      context,
      runtime: await this.#liveRulesRuntime(),
      random: secureRandomInt,
      captures,
      staged
    })
    const current = this.#journal.readCurrent()
    if (
      !current ||
      current.authorityEpoch !== value.authorityEpoch ||
      this.#cache?.scene?.id !== before.id ||
      this.#cache.scene.version !== before.version
    )
      throw new LiveSessionRouteError(409)
    const next = createNativeLiveSessionState(prepared.nextScene)
    const sequence = current.sequence + 1
    const { delta: predictedDelta, version } = prepared.expectedScene
    this.#journal.beginExternalCommit({
      actorId: admission.userId,
      authorityEpoch: value.authorityEpoch,
      commandId: command.commandId,
      expectedSequence: current.sequence,
      expectedStateChecksum: current.stateChecksum,
      fingerprint,
      nextStateChecksum: next.stateChecksum,
      nextStateJson: next.stateJson,
      // A recovery knows only the predicted Scene change, not the decision it opened.
      receiptJson: JSON.stringify(
        liveSessionWebSocketServerMessageDtoSchema.parse({
          commandId: command.commandId,
          delta: predictedDelta
            ? {
                scope: 'SCENE',
                result: {
                  commandId: command.commandId,
                  delta: predictedDelta,
                  occurrence: null,
                  replayed: false,
                  sceneId: before.id,
                  version
                }
              }
            : version !== before.version
              ? { scope: 'SCENE_VERSION', sceneId: before.id, version }
              : null,
          sequence,
          type: 'COMMAND_COMMITTED'
        })
      ),
      subject: { kind: 'SCENE_SAVE', saveId: prepared.saveId }
    })
    const committed = await this.#sendExternalCommit(command.commandId, () =>
      commitExternalSceneCommit({
        environment: this.env,
        accessToken: admission.accessToken,
        actor,
        prepared,
        authority: {
          sequence,
          expectedStateChecksum: current.stateChecksum,
          stateChecksum: next.stateChecksum
        }
      })
    )
    const result = sceneCommandResultDtoSchema.parse({
      commandId: committed.scene.commandId,
      delta: committed.scene.delta,
      occurrence: committed.scene.occurrence,
      replayed: committed.scene.replayed,
      sceneId: committed.scene.sceneId,
      version: committed.scene.version
    })
    const receipt = liveSessionWebSocketServerMessageDtoSchema.parse(
      committed.encounter
        ? {
            commandId: command.commandId,
            delta: { scope: 'ENCOUNTER', result: committed.encounter },
            sequence,
            type: 'COMMAND_COMMITTED'
          }
        : {
            commandId: command.commandId,
            delta: { scope: 'SCENE', result },
            sequence,
            type: 'COMMAND_COMMITTED'
          }
    )
    this.#journal.completeExternalCommit({
      authorityEpoch: value.authorityEpoch,
      commandId: command.commandId,
      receiptJson: JSON.stringify(receipt)
    })
    const latest = this.#cache
    if (latest?.scene?.id === before.id)
      this.#cache = {
        ...latest,
        movementDecisionPending:
          prepared.kind === 'MOVEMENT'
            ? result.occurrence?.status === 'PENDING'
            : latest.movementDecisionPending,
        scene: prepared.nextScene
      }
    this.#broadcastSceneCommitted(
      { commandId: command.commandId, sequence },
      before,
      prepared.nextScene,
      result,
      socket
    )
    if (prepared.fogChanged) this.#broadcastStateSync()
    return committed
  }

  /**
   * The room's synchronized presented Scene that Convex-first commands plan against, with its bound
   * Encounter and movement hold (D26); null until the Scene is synchronized.
   */
  #externalSceneContext():
    | (ExternalSceneContext & Pick<TransientCache, 'encounterId' | 'movementDecisionPending'>)
    | null {
    const synchronized = this.#cache?.synchronized ? this.#cache : null
    if (!synchronized?.scene || !synchronized.presentation) return null
    return {
      scene: synchronized.scene,
      baseOrdinals: synchronized.baseOrdinals,
      characterRevisions: synchronized.characterRevisions,
      presentation: synchronized.presentation,
      encounterId: synchronized.encounterId,
      movementDecisionPending: synchronized.movementDecisionPending
    }
  }

  /**
   * Sends the commit behind a write-ahead record. A 4xx response means Convex rolled it back, so the
   * record is dropped; without one (or on a 5xx) the outcome is unknown and the record stays for
   * the next command to settle.
   */
  async #sendExternalCommit<Result>(
    commandId: string,
    commit: () => Promise<Result>
  ): Promise<Result> {
    try {
      return await commit()
    } catch (error) {
      if (error instanceof LiveSessionRouteError && error.status >= 400 && error.status < 500)
        this.#journal.abandonExternalCommit(commandId)
      throw error
    }
  }

  /**
   * Binds an Encounter to the presented Scene (D47, GM only) Convex-first like a Scene commit: the
   * write-ahead record, then a commit that advances Convex's authority to the next sequence and
   * that Convex refuses after `expiresAt`, so a resolve can abandon it safely. The room's state is
   * unchanged, but its Scene now runs bound moves through Encounter rules. Every member gets the
   * binding with the new sequence.
   */
  async #executeEncounterBinding(
    socket: WebSocket,
    admission: Admission,
    value: SocketAttachment,
    command: BindEncounterToPresentedSceneInputDto
  ): Promise<void> {
    const commandId = command.commandId
    const fingerprint = checksumCanonicalJson({ command, scope: 'ENCOUNTER_BINDING' })
    const prior = this.#journal.lookupCommand({ actorId: admission.userId, commandId, fingerprint })
    if (prior.kind === 'MISMATCHED_REUSE') {
      this.#rejectCommand(
        socket,
        commandId,
        'INVALID_COMMAND',
        'The command ID was already used for different input.'
      )
      return
    }
    if (prior.kind === 'REPLAY') {
      send(socket, replayReceipt(prior.receipt.receiptJson))
      return
    }
    if (admission.role !== 'OWNER') {
      send(socket, {
        code: 'DOMAIN_REJECTED',
        commandId,
        currentSequence: this.#journal.readCurrent()?.sequence ?? 0,
        message: DOMAIN_REJECTION_MESSAGES.GM_ONLY,
        reason: 'GM_ONLY',
        warnings: null,
        type: 'COMMAND_REJECTED'
      })
      return
    }
    const synchronized = this.#cache?.synchronized ? this.#cache : null
    if (!synchronized?.scene || !synchronized.presentation) {
      this.#rejectCommand(
        socket,
        commandId,
        'UNAVAILABLE',
        'Scene synchronization is required before changing the live Scene.'
      )
      return
    }
    const sceneId = synchronized.scene.id
    const { presentation } = synchronized
    try {
      await this.#flushOutbox()
      const current = this.#journal.readCurrent()
      if (!current || current.authorityEpoch !== value.authorityEpoch)
        throw new LiveSessionRouteError(409)
      const sequence = current.sequence + 1
      const expiresAt = Date.now() + LIVE_SESSION_ROUTE_TIMEOUT_MS
      const receipt = (result: BindEncounterToPresentedSceneResultDto) =>
        liveSessionWebSocketServerMessageDtoSchema.parse({
          commandId,
          delta: { scope: 'ENCOUNTER_BINDING', result },
          sequence,
          type: 'COMMAND_COMMITTED'
        })
      this.#journal.beginExternalCommit({
        actorId: admission.userId,
        authorityEpoch: value.authorityEpoch,
        commandId,
        expectedSequence: current.sequence,
        expectedStateChecksum: current.stateChecksum,
        fingerprint,
        nextStateChecksum: current.stateChecksum,
        nextStateJson: current.stateJson,
        receiptJson: JSON.stringify(
          receipt({
            commandId: commandId.toLowerCase(),
            encounterId: command.encounterId.toLowerCase(),
            replayed: false,
            sceneId
          })
        ),
        subject: {
          kind: 'ENCOUNTER_BINDING',
          encounterId: command.encounterId,
          commandId,
          expiresAt
        }
      })
      const result = await this.#sendExternalCommit(commandId, () =>
        callLiveSessionRoute(this.env, admission.accessToken, 'encounterBindingCommit', {
          campaignId: value.campaignId,
          authorityEpoch: value.authorityEpoch,
          expectedUserId: admission.userId,
          expectedRole: admission.role,
          command,
          sceneId,
          presentation,
          authority: {
            sequence,
            expectedStateChecksum: current.stateChecksum,
            stateChecksum: current.stateChecksum
          },
          expiresAt
        })
      )
      const committed = receipt(result)
      this.#journal.completeExternalCommit({
        authorityEpoch: value.authorityEpoch,
        commandId,
        receiptJson: JSON.stringify(committed)
      })
      if (this.#cache?.scene?.id === result.sceneId)
        this.#cache = { ...this.#cache, encounterId: result.encounterId }
      this.#previewControls.clear()
      for (const member of this.ctx.getWebSockets())
        if (this.#liveAdmission(member)) send(member, committed)
    } catch (error) {
      this.#rejectExternal(socket, commandId, error, undefined)
    }
  }

  /** Maps a failed Convex-first Scene command to its user-safe rejection. */
  #rejectExternal(
    socket: WebSocket,
    commandId: string,
    error: unknown,
    correction: LiveSessionCorrectionDto | undefined
  ): void {
    if (error instanceof LiveSessionDomainRejectionError) {
      send(socket, {
        code: 'DOMAIN_REJECTED',
        commandId,
        ...(correction ? { correction } : {}),
        currentSequence: this.#journal.readCurrent()?.sequence ?? 0,
        message: error.rejection.message,
        reason: error.rejection.reason,
        warnings: error.rejection.reason === 'RULE_WARNINGS' ? error.rejection.warnings : null,
        type: 'COMMAND_REJECTED'
      })
      return
    }
    const status = error instanceof LiveSessionRouteError ? error.status : 0
    this.#rejectCommand(
      socket,
      commandId,
      status === 409 ? 'STALE_STATE' : 'UNAVAILABLE',
      status === 409
        ? 'The table changed; the current state has been restored.'
        : status === 503
          ? LIVE_SESSION_TRY_AGAIN_MESSAGE
          : 'The table change could not be saved.',
      this.#journal.readCurrent()?.sequence ?? 0,
      correction
    )
  }

  /** Whether a member's Scene command will commit to Convex first on the synchronized Scene. */
  #isExternalCommand(command: unknown): boolean {
    const parsed = liveSessionSceneCommandInputSchema.safeParse(command)
    const cached = this.#cache?.synchronized ? this.#cache : null
    return (
      parsed.success &&
      !!cached?.scene &&
      isExternalSceneCommand(parsed.data, cached.scene, cached.encounterId)
    )
  }

  /**
   * An Encounter command the room forwarded may have closed a held movement decision (the Run
   * completed or its mover left), so the hold is reread from Convex.
   */
  async #refreshMovementHold(
    socket: WebSocket,
    admission: Admission,
    value: SocketAttachment
  ): Promise<void> {
    const cached = this.#cache
    if (!cached?.movementDecisionPending) return
    const capture = await this.#capture(value, admission, [{ admission, socket }], 'AUTHORITY', [])
    if (
      this.#cache === cached &&
      capture.sceneHeader?.id === cached.scene?.id &&
      capture.sceneEncounterId === cached.encounterId
    )
      this.#cache = { ...cached, movementDecisionPending: capture.sceneMovementDecisionPending }
  }

  /**
   * Settles a Convex-first commit whose outcome the room did not see (a timeout or a restart):
   * Convex reports whether it committed. A committed one is applied; members never received it,
   * so the Scene cache is dropped and every socket resynchronizes. An abandoned one is forgotten.
   */
  async #settleExternalCommit(): Promise<void> {
    const record = this.#journal.readExternalCommit()
    const current = this.#journal.readCurrent()
    const campaignId = this.#roomCampaignId()
    if (!record || !current || !campaignId) return
    const { outcome } = await callLiveSessionRoute(this.env, null, 'externalCommitResolve', {
      campaignId,
      epoch: current.authorityEpoch,
      subject: record.subject,
      expectedSequence: record.expectedSequence,
      expectedStateChecksum: record.expectedStateChecksum,
      nextStateChecksum: record.nextStateChecksum
    })
    if (outcome === 'ABANDONED') {
      this.#journal.abandonExternalCommit(record.commandId)
      return
    }
    this.#journal.completeExternalCommit({
      authorityEpoch: current.authorityEpoch,
      commandId: record.commandId
    })
    this.#bumpCacheGeneration()
    for (const socket of this.ctx.getWebSockets()) this.#challenge(socket)
  }

  #liveRulesRuntime(): Promise<RulesRuntimeService> {
    this.#rulesRuntime ??= createNativeLiveRulesRuntime(this.env.RULES_CONTINUATION_SECRET)
    return this.#rulesRuntime
  }

  /**
   * Sends one committed Scene command to every member, projected for each. Only `initiator` sees
   * its Encounter occurrence; a member who cannot see the change gets the version bump.
   */
  #broadcastSceneCommitted(
    committed: { commandId: string; sequence: number },
    before: CampaignSceneStateDto,
    after: CampaignSceneStateDto,
    result: SceneCommandResultDto,
    initiator: WebSocket | null
  ): void {
    for (const socket of this.ctx.getWebSockets()) {
      const admission = this.#liveAdmission(socket)
      if (!admission) continue
      const occurrence = socket === initiator ? result.occurrence : null
      const delta = result.delta
        ? projectSceneDeltaForViewer(before, after, viewer(admission), result.delta)
        : null
      send(socket, {
        ...committed,
        delta: delta
          ? { scope: 'SCENE', result: { ...result, delta, occurrence } }
          : after.version !== before.version
            ? { scope: 'SCENE_VERSION', sceneId: result.sceneId, version: result.version }
            : occurrence
              ? { scope: 'SCENE', result: { ...result, occurrence } }
              : null,
        type: 'COMMAND_COMMITTED'
      })
    }
  }
  #rejectCommand(
    socket: WebSocket,
    commandId: string,
    code: LiveSessionCommandRejectionCodeDto,
    message: string,
    currentSequence = this.#journal.readCurrent()?.sequence ?? 0,
    correction?: LiveSessionCorrectionDto
  ): void {
    send(socket, {
      code,
      commandId,
      ...(correction ? { correction } : {}),
      currentSequence,
      message,
      reason: null,
      warnings: null,
      type: 'COMMAND_REJECTED'
    })
  }

  /** Committed entries stay in the outbox; the next command, admission or drain retries them. */
  #publishInBackground(): void {
    this.ctx.waitUntil(this.#flushOutbox().catch(() => undefined))
  }

  #flushOutbox(): Promise<void> {
    if (this.#outboxFlush) return this.#outboxFlush
    const work = this.#publishPending()
    this.#outboxFlush = work
    void work.then(
      () => {
        if (this.#outboxFlush === work) this.#outboxFlush = null
      },
      () => {
        if (this.#outboxFlush === work) this.#outboxFlush = null
      }
    )
    return work
  }

  async #publishPending(): Promise<void> {
    while (true) {
      const entry = this.#journal.listPending(1)[0]
      if (!entry) return
      const input = liveSessionPublishInputSchema.parse(JSON.parse(entry.payloadJson))
      const published = await callLiveSessionRoute(this.env, null, 'publish', input)
      if (
        published.authority.epoch !== input.epoch ||
        published.authority.persistedSequence !== entry.sequence ||
        published.authority.persistedStateChecksum !== entry.stateChecksum ||
        published.scope !== 'SCENE' ||
        !equalCanonicalJson(published.sceneResult, input.expectedSceneResult)
      )
        throw new Error('Live Session publication result is inconsistent.')
      this.#journal.acknowledge({
        authorityEpoch: input.epoch,
        stateChecksum: entry.stateChecksum,
        throughSequence: entry.sequence
      })
    }
  }
  #broadcastStateSync(): void {
    for (const socket of this.ctx.getWebSockets()) {
      const admission = this.#liveAdmission(socket)
      if (admission) this.#sendStateSync(socket, admission)
    }
  }

  /**
   * Renders one preview sample from room memory within its message: the Scene cache, the members'
   * admissions and leased bound-token control and Character-vision checks. A sample never calls or
   * waits on Convex or storage. A missing or aging input starts a background refresh, and samples it
   * cannot serve yet are dropped, since previews are lossy (ADR 0035 Amendment 15).
   */
  #broadcastTransient(
    origin: WebSocket,
    originAdmission: Admission,
    envelope: SceneTransientEnvelopeDto
  ): void {
    if (this.#presentationChanging) return
    const originAttachment = attachment(origin)
    if (!originAttachment) return this.#challenge(origin)
    const candidates = this.ctx.getWebSockets().flatMap((socket) => {
      const candidate = this.#liveAdmission(socket)
      return candidate ? [{ admission: candidate, socket }] : (this.#challenge(socket), [])
    })
    const cached = this.#cache
    if (!cached) return this.#refreshPreviewScene(originAttachment, originAdmission, candidates)
    const scene = cached.scene
    if (!scene || scene.id !== envelope.sceneId || scene.version !== envelope.baselineVersion)
      return
    let boundTokenControl: PreviewControl['control'] | null = null
    if (envelope.kind === 'TOKEN_DRAG_PREVIEW') {
      if (!this.#previewVisionCurrent(cached, originAttachment, originAdmission, candidates)) return
      // A player's preview on an Encounter-bound Scene needs their bound-actor control (D25).
      if (originAdmission.role === 'PLAYER' && cached.encounterId !== null) {
        boundTokenControl = this.#previewBoundTokenControl(
          cached,
          originAttachment,
          originAdmission,
          candidates
        )
        if (!boundTokenControl) return
      }
    }
    this.#sendTransient(
      origin,
      originAttachment,
      originAdmission,
      candidates,
      boundTokenControl,
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
    this.ctx.waitUntil(
      work()
        .catch(() => undefined)
        .finally(() => {
          refresh.running = false
        })
    )
  }

  /** Rebuilds a missing or stale Scene cache in the background, as `SYNCHRONIZE_SCENE` does. */
  #refreshPreviewScene(
    value: SocketAttachment,
    admission: Admission,
    candidates: readonly { admission: Admission; socket: WebSocket }[]
  ): void {
    this.#refreshPreviewInBackground('scene', async () => {
      await this.#refreshSceneCache(value, admission, candidates)
      const sceneId = this.#cache?.scene?.id
      if (sceneId) this.#overlayDurableSceneCache(sceneId)
    })
  }

  /**
   * Whether the Character revisions behind the cached vision were confirmed within the preview
   * lease (D33). From half the lease, one background read rechecks them; a changed revision rebuilds
   * the Scene cache with the new vision.
   */
  #previewVisionCurrent(
    cached: TransientCache,
    value: SocketAttachment,
    admission: Admission,
    candidates: readonly { admission: Admission; socket: WebSocket }[]
  ): boolean {
    if (cached.characterRevisions.length === 0) return true
    const age = Date.now() - cached.visionCheckedAt
    if (age >= ROOM_LIMITS.previewLeaseMs / 2)
      this.#refreshPreviewInBackground('scene', async () => {
        const checkedAt = Date.now()
        if (!(await this.#visionRevisionsCurrent(value, admission, cached.characterRevisions))) {
          await this.#refreshSceneCache(value, admission, candidates)
          return
        }
        if (this.#cache?.key === cached.key)
          this.#cache = { ...this.#cache, visionCheckedAt: checkedAt }
      })
    return age < ROOM_LIMITS.previewLeaseMs
  }

  /**
   * The player's leased bound-token control on the cached Encounter-bound Scene, or null while no
   * lease is current. From half the lease, one background AUTHORITY capture renews it.
   */
  #previewBoundTokenControl(
    cached: TransientCache,
    value: SocketAttachment,
    admission: Admission,
    candidates: readonly { admission: Admission; socket: WebSocket }[]
  ): PreviewControl['control'] | null {
    const lease = this.#previewControls.get(admission.userId)
    const age =
      lease &&
      lease.cacheGeneration === this.#cacheGeneration &&
      lease.membershipEpoch === admission.membershipEpoch &&
      lease.sceneId === cached.scene?.id &&
      lease.encounterId === cached.encounterId
        ? Date.now() - lease.checkedAt
        : Number.POSITIVE_INFINITY
    if (age >= ROOM_LIMITS.previewLeaseMs / 2)
      this.#refreshPreviewInBackground(`control:${admission.userId}`, async () => {
        const cacheGeneration = this.#cacheGeneration
        const checkedAt = Date.now()
        const capture = await this.#capture(value, admission, candidates, 'AUTHORITY', [])
        if (
          cacheGeneration !== this.#cacheGeneration ||
          capture.origin.userId !== admission.userId ||
          capture.origin.role !== admission.role ||
          capture.origin.membershipEpoch !== admission.membershipEpoch
        )
          return
        this.#previewControls.set(admission.userId, {
          cacheGeneration,
          checkedAt,
          control: capture.originBoundTokenControl,
          encounterId: capture.sceneEncounterId,
          membershipEpoch: capture.origin.membershipEpoch,
          sceneId: capture.sceneHeader?.id ?? null
        })
      })
    return lease && age < ROOM_LIMITS.previewLeaseMs ? lease.control : null
  }

  /** Whether the Character revisions behind the cached Scene vision are still current (D33). */
  async #visionRevisionsCurrent(
    value: SocketAttachment,
    admission: Admission,
    observedCharacterRevisions: TransientCache['characterRevisions']
  ): Promise<boolean> {
    try {
      const { current } = await callLiveSessionRoute(
        this.env,
        admission.accessToken,
        'visionRevisions',
        {
          campaignId: value.campaignId,
          expectedRole: admission.role,
          expectedUserId: admission.userId,
          observedCharacterRevisions
        }
      )
      return current
    } catch (error) {
      if (error instanceof LiveSessionRouteError && error.status === 409) return false
      throw error
    }
  }
  #overlayDurableSceneCache(sceneId: string): void {
    const current = this.#journal.readCurrent()
    if (!current || this.#cache?.scene?.id !== sceneId) return
    const durableScene = hydrateNativeLiveSessionState(
      current.stateJson,
      current.stateChecksum
    ).scene
    if (durableScene?.id === sceneId && durableScene.version >= this.#cache.scene.version)
      this.#cache = { ...this.#cache, scene: durableScene }
  }

  #matchesSceneSynchronization(
    sceneId: string,
    version: number,
    expectedPresentationVersion: number
  ): boolean {
    return (
      this.#cache?.scene?.id === sceneId &&
      this.#cache.scene.version >= version &&
      this.#cache.presentation?.expectedPresentationVersion === expectedPresentationVersion
    )
  }

  async #synchronizeScene(
    socket: WebSocket,
    sceneId: string,
    version: number,
    expectedPresentationVersion: number
  ): Promise<void> {
    const value = attachment(socket)
    const admission = this.#liveAdmission(socket)
    if (!value || !admission) return this.#challenge(socket)
    this.#overlayDurableSceneCache(sceneId)
    if (this.#matchesSceneSynchronization(sceneId, version, expectedPresentationVersion)) {
      if (!this.#cache) throw new Error('Synchronized Scene cache is missing.')
      this.#cache = { ...this.#cache, synchronized: true }
      this.#broadcastStateSync()
      return
    }

    const candidates = this.ctx.getWebSockets().flatMap((candidateSocket) => {
      const candidate = this.#liveAdmission(candidateSocket)
      return candidate ? [{ admission: candidate, socket: candidateSocket }] : []
    })
    const sync = this.#refreshSceneCache(value, admission, candidates).then(() => undefined)
    this.#sceneSync = sync
    try {
      await sync
      this.#overlayDurableSceneCache(sceneId)
      if (this.#matchesSceneSynchronization(sceneId, version, expectedPresentationVersion)) {
        if (!this.#cache) throw new Error('Synchronized Scene cache is missing.')
        this.#cache = { ...this.#cache, synchronized: true }
        this.#broadcastStateSync()
      }
    } catch {
      this.#cache = null
      this.#challenge(socket, admission.generation)
    } finally {
      if (this.#sceneSync === sync) this.#sceneSync = null
    }
  }

  async #refreshSceneCache(
    value: SocketAttachment,
    admission: Admission,
    candidates: readonly { admission: Admission; socket: WebSocket }[]
  ): Promise<LiveSessionTransientCapture | null> {
    if (this.#presentationChanging) return null
    const generation = this.#cacheGeneration
    let staleRetryUsed = false
    let capture: LiveSessionTransientCapture
    try {
      capture = await this.#capture(
        value,
        admission,
        candidates,
        'FULL',
        this.#cache?.characterRevisions ?? []
      )
    } catch (error) {
      if (!(error instanceof LiveSessionRouteError) || error.status !== 409) throw error
      if (generation !== this.#cacheGeneration || this.#presentationChanging) return null
      staleRetryUsed = true
      this.#cache = null
      capture = await this.#capture(value, admission, candidates, 'FULL', [])
    }
    if (generation !== this.#cacheGeneration || this.#presentationChanging) return null
    const key = cacheKey(capture)
    if (this.#cache?.key === key) return capture

    const hydrated = await hydrateNativeTransientScene(this.env, admission.accessToken, capture)
    let scene = hydrated.scene
    let revisions = hydrated.characterRevisions
    let baseOrdinals = hydrated.baseOrdinals
    // The final capture confirms `revisions`; any retry confirms them later still.
    const visionCheckedAt = Date.now()
    let finalCapture: LiveSessionTransientCapture
    try {
      finalCapture = await this.#capture(value, admission, candidates, 'FULL', revisions)
    } catch (error) {
      if (!(error instanceof LiveSessionRouteError) || error.status !== 409) throw error
      if (generation !== this.#cacheGeneration || this.#presentationChanging) return null
      if (staleRetryUsed) throw error
      staleRetryUsed = true
      this.#cache = null
      const retry = await this.#capture(value, admission, candidates, 'FULL', [])
      const hydratedRetry = await hydrateNativeTransientScene(
        this.env,
        admission.accessToken,
        retry
      )
      scene = hydratedRetry.scene
      revisions = hydratedRetry.characterRevisions
      baseOrdinals = hydratedRetry.baseOrdinals
      finalCapture = await this.#capture(value, admission, candidates, 'FULL', revisions)
      if (!equalCanonicalJson(authorityFingerprint(retry), authorityFingerprint(finalCapture)))
        return null
    }
    if (generation !== this.#cacheGeneration || this.#presentationChanging) return null
    if (!equalCanonicalJson(authorityFingerprint(capture), authorityFingerprint(finalCapture))) {
      this.#cache = null
      return null
    }
    this.#cache = {
      baseOrdinals,
      characterRevisions: revisions,
      encounterId: finalCapture.sceneEncounterId,
      key: cacheKey(finalCapture),
      movementDecisionPending: finalCapture.sceneMovementDecisionPending,
      scene,
      presentation: finalCapture.presentation
        ? { expectedPresentationVersion: finalCapture.presentation.version }
        : null,
      synchronized: false,
      visionCheckedAt
    }
    return finalCapture
  }
  async #capture(
    value: SocketAttachment,
    admission: Admission,
    candidates: readonly { admission: Admission; socket: WebSocket }[],
    mode: 'AUTHORITY' | 'FULL',
    observedCharacterRevisions: LiveSessionTransientCapture['observedCharacterRevisions']
  ): Promise<LiveSessionTransientCapture> {
    return callLiveSessionRoute(this.env, admission.accessToken, 'capture', {
      campaignId: value.campaignId,
      expectedRole: admission.role,
      expectedUserId: admission.userId,
      mode,
      observedCharacterRevisions,
      recipientUserIds: [...new Set(candidates.map(({ admission: candidate }) => candidate.userId))]
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
    boundTokenControl: PreviewControl['control'] | null,
    scene: CampaignSceneStateDto,
    envelope: SceneTransientEnvelopeDto
  ): void {
    const key = streamKey(envelope)
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
          originBoundTokenControl: boundTokenControl
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
      const previewScene = {
        ...scene,
        tokens: scene.tokens.map((candidate) =>
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

  /** The Campaign this room is bound to by its first admitted ticket, if any. */
  #roomCampaignId(): string | null {
    return (
      this.ctx.storage.sql
        .exec<NativeRoomIdentityRow>('SELECT campaign_id FROM native_room_identity WHERE id = 1')
        .toArray()[0]?.campaign_id ?? null
    )
  }

  #liveAdmission(socket: WebSocket): Admission | null {
    const current = this.#admissions.get(socket)
    if (!current || !this.#isLive(current)) {
      this.#admissions.delete(socket)
      return null
    }
    return current
  }

  #isLive(admission: Admission): boolean {
    return Date.now() < admission.deadline
  }

  #recipientUserIds(): string[] {
    return [
      ...new Set(
        [...this.#admissions.values()]
          .filter((admission) => this.#isLive(admission))
          .map((admission) => admission.userId)
      )
    ]
  }

  #movementIndex(scene: CampaignSceneStateDto): SceneBarrierIndex {
    const cached = this.#movementIndexes.get(scene.id)
    if (cached?.barriers === scene.barriers) return cached.index
    const index = new SceneBarrierIndex(scene.barriers)
    this.#movementIndexes.set(scene.id, { barriers: scene.barriers, index })
    return index
  }

  #invalidate(socket: WebSocket): number {
    const generation = (this.#generations.get(socket) ?? 0) + 1
    this.#generations.set(socket, generation)
    this.#admissions.delete(socket)
    this.#authenticating.delete(socket)
    return generation
  }

  #challenge(socket: WebSocket, expectedGeneration?: number): void {
    if (expectedGeneration !== undefined && this.#generations.get(socket) !== expectedGeneration)
      return
    // Traffic arriving while admission is being verified must not cancel that verification.
    const pending = this.#authenticating.get(socket)
    if (
      expectedGeneration === undefined &&
      !this.#admissions.has(socket) &&
      pending &&
      pending.generation === this.#generations.get(socket) &&
      Date.now() < pending.deadline
    )
      return
    this.#invalidate(socket)
    send(socket, { type: 'AUTHENTICATION_REQUIRED' })
  }

  #closeIfCurrent(socket: WebSocket, expectedGeneration: number, reason: string): void {
    if (this.#generations.get(socket) === expectedGeneration) this.#closeSocket(socket, reason)
  }

  #closeSocket(socket: WebSocket, reason: string): void {
    this.#forgetSocket(socket)
    if (socket.readyState === WebSocket.OPEN) socket.close(1008, reason)
  }

  #forgetSocket(socket: WebSocket): void {
    this.#invalidate(socket)
    this.#budgets.delete(socket)
    this.#previewStreams.delete(socket)
  }

  async #presentScene(input: LiveSessionPresentationControlInput) {
    if (this.#activation) await this.#activation
    this.#presentationChanging = true
    this.#bumpCacheGeneration()
    this.#movementIndexes.clear()
    try {
      await this.#flushOutbox()
      await this.#settleExternalCommit()
      const current = this.#journal.readCurrent()
      if (
        current &&
        (current.authorityEpoch !== input.operation.epoch || current.status !== 'ACTIVE')
      )
        throw new Error('Live Session authority changed.')
      if (current && current.sequence !== current.publishedSequence)
        throw new Error('Live Session publication is incomplete.')
      return await callLiveSessionRoute(this.env, null, 'present', {
        campaignId: input.campaignId,
        actorUserId: input.operation.actorUserId,
        epoch: input.operation.epoch,
        input: input.operation.input,
        expectedSequence: current?.sequence ?? 0,
        expectedStateChecksum: current?.stateChecksum ?? null
      })
    } finally {
      this.#bumpCacheGeneration()
      this.#presentationChanging = false
      for (const socket of this.ctx.getWebSockets()) this.#challenge(socket)
    }
  }

  async #closeRoom(campaignId: string): Promise<number> {
    const current = this.#journal.readCurrent()
    if (!current || current.status === 'RELEASED') return this.#closeSockets({ type: 'CLOSE_ROOM' })

    // No new commands arrive once sockets close; in-flight ones (including forwarded Encounter
    // commands, which Convex fences only by DO_ACTIVE authority) finish before the drain fence.
    const closed = this.#closeSockets({ type: 'CLOSE_ROOM' })
    await this.#commandChain
    await this.#settleExternalCommit()
    const draining = this.#journal.readCurrent() ?? current
    const fence = {
      authorityEpoch: draining.authorityEpoch,
      finalSequence: draining.drainFinalSequence ?? draining.sequence,
      finalStateChecksum: draining.drainFinalChecksum ?? draining.stateChecksum
    }
    this.#journal.beginDrain(fence)
    const input = {
      campaignId,
      epoch: fence.authorityEpoch,
      finalSequence: fence.finalSequence,
      finalStateChecksum: fence.finalStateChecksum
    }
    let drainError: unknown
    try {
      const authority = await callLiveSessionRoute(this.env, null, 'beginDrain', input)
      if (
        authority.epoch !== input.epoch ||
        authority.phase !== 'DRAINING' ||
        authority.finalSequence !== input.finalSequence ||
        authority.finalStateChecksum !== input.finalStateChecksum
      )
        throw new Error('Live Session drain result is inconsistent.')
    } catch (error) {
      drainError = error
    }
    await this.#flushOutbox()
    try {
      await callLiveSessionRoute(this.env, null, 'release', input)
    } catch (error) {
      throw drainError ?? error
    }
    this.#journal.release(fence)
    // The next admitted socket bootstraps a fresh epoch over the released journal.
    this.#activation = null
    this.ctx.storage.sql.exec('DELETE FROM room_idle_release WHERE id = 1')
    return closed
  }

  #closeSockets(
    operation:
      | { type: 'CLOSE_ROOM' }
      | { membershipEpoch: string; type: 'EVICT_USER'; userId: string }
  ): number {
    let closed = 0
    for (const socket of this.ctx.getWebSockets()) {
      const value = attachment(socket)
      if (
        operation.type === 'EVICT_USER' &&
        (!value ||
          value.userId !== operation.userId ||
          value.membershipEpoch !== operation.membershipEpoch)
      )
        continue
      this.#invalidate(socket)
      this.#previewStreams.delete(socket)
      if (socket.readyState === WebSocket.OPEN)
        socket.close(
          1008,
          operation.type === 'CLOSE_ROOM'
            ? 'The Campaign live table closed.'
            : 'Campaign access ended.'
        )
      closed += 1
    }
    this.#bumpCacheGeneration()
    this.#movementIndexes.clear()
    return closed
  }

  /** Cached Scene state and rules captures belong to one generation; a bump discards both. */
  #bumpCacheGeneration(): void {
    this.#cacheGeneration += 1
    this.#cache = null
    this.#captureCache.clear()
  }

  #json(value: string): unknown {
    try {
      return JSON.parse(value) as unknown
    } catch {
      return null
    }
  }
}
