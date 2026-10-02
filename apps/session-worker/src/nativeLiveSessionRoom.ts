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
import type { LiveSessionRoomAuthorization } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import type { LiveSessionScenePublicationDto } from '@artificer-toolkit/schema/api/liveSessionState'
import type { SceneBaseOrdinals } from '@artificer-toolkit/schema/api/sceneGeometry'
import type { SceneLiveStateHeader } from '@artificer-toolkit/schema/api/sceneLiveState'
import type { SceneUndoExecuteInput } from '@artificer-toolkit/schema/api/sceneUndo'
import { DOMAIN_REJECTION_MESSAGES } from '@artificer-toolkit/schema/api/domainRejections'
import {
  LIVE_SESSION_TRY_AGAIN_MESSAGE,
  type LiveSessionCommandDto
} from '@artificer-toolkit/schema/api/liveSessionCommands'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { readCharacterCommandReplay } from '@artificer-toolkit/encounter-persistence/characterSheetReceipts'
import { readMovementDecisionPending } from '@artificer-toolkit/encounter-persistence/occurrenceOwner'
import { assertCampaignGmSheetCommandAllowed } from '@artificer-toolkit/rules-runtime/character/sheetCommandValidation'
import { CharacterSheetCommandError } from '@artificer-toolkit/rules-runtime/character/sheetCommandError'
import {
  sceneCommandResultDtoSchema,
  type BindEncounterToPresentedSceneInputDto,
  type CampaignSceneStateDto,
  type SceneCommandResultDto,
  type SceneTransientEnvelopeDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { checksumCanonicalJson, equalCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  applySceneDelta,
  extendSceneMovementPath,
  isScenePointExplored,
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
  EncounterCommandResultDto,
  ResolveRuleOccurrenceInputDto,
  VoidRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import type { RoomNativeEncounterCommand } from '@artificer-toolkit/schema/api/liveSessionEncounterCommand'
import { decodeJwt } from 'jose'
import { z } from 'zod'

import { DurableCommandJournal, DurableCommandJournalError } from './durableCommandJournal.js'
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
  LiveSessionDomainRejectionError,
  LiveSessionRouteError
} from './liveSessionRoutes.js'
import { encounterCommandRefusal, sceneNotPresentedRejection } from './nativeRoomEncounterCommand.js'
import { LiveCaptureCache, type LiveCaptureReads } from './nativeCaptureCache.js'
import type { ExternalSceneCommand, ExternalSceneContext } from './nativeExternalSceneCommit.js'
import { createNativeLiveRulesRuntime, secureRandomInt } from './nativeRulesRuntime.js'
import { hydrateNativeTransientScene } from './nativeSceneClient.js'
import { RoomEncounterStore } from './roomEncounterStore.js'
import { RoomInputs } from './roomInputs.js'
import { RoomCheckpoints } from './roomCheckpoints.js'
import { publishRoomCheckpoint } from './roomCheckpointPublication.js'
import { persistRoomSceneCommand } from './roomSceneCommandPersistence.js'
import { executeRoomSceneGeometry } from './roomSceneGeometryCommand.js'
import { readRoomSceneHeader } from './roomSceneRead.js'
import { composeRoomSceneVision } from './roomSceneVision.js'
import { executeRoomSceneBinding } from './roomSceneBinding.js'
import { NoSceneMoveToUndoError, publishRoomSceneUndo } from './roomSceneUndo.js'
import { executeRoomCharacterSheetCommand } from './roomCharacterSheetCommands.js'
import { CampaignChatCommandError, executeRoomCampaignChatCommand } from './roomChatCommands.js'
import {
  RoomAccountBuckets,
  RoomRateLimitedError,
  type AccountBucketKind
} from './roomRateLimits.js'
import { readRoomActorDepartures, reconcileRoomActorDepartures } from './roomActorReconcile.js'
import { RoomCharacterSheetFeed } from './roomCharacterSheetFeed.js'
import { loadRoomContentSnapshots } from './roomContentSnapshots.js'
import {
  executeRoomEncounterCommand,
  replayRoomEncounterCommand,
  readRoomEncounterPlayAuthorization,
  roomEncounterCommandFingerprint
} from './roomEncounterCommands.js'
import {
  readRoomEncounterResponseRoute,
  roomOwnsEncounterVoid
} from './roomEncounterResponseRouting.js'
import { EncounterDomainRejection } from '@artificer-toolkit/encounter-persistence/domainRejections'
import {
  admitsRoomMember,
  RoomAuthorization,
  roomBoundTokenControl,
  roomVisionCurrent
} from './roomAuthorization.js'
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
 * barrier's definition ordinal and the bound Encounter.
 */
interface TransientCache {
  baseOrdinals: SceneBaseOrdinals
  characterRevisions: LiveSessionTransientCapture['observedCharacterRevisions']
  visionEncounterIds: string[]
  encounterId: string | null
  key: string
  scene: CampaignSceneStateDto | null
  /** Authored token vision only; derived Character vision is never persisted as an override. */
  uncomposedScene: CampaignSceneStateDto | null
  sceneHeader: SceneLiveStateHeader | null
  presentation: LiveSessionScenePublicationDto['presentation'] | null
  synchronized: boolean
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
    sceneHeader: capture.sceneHeader,
    systemId: capture.systemId,
    visionFreshness: capture.visionFreshness
  }
}

export class NativeLiveSessionRoom extends DurableObject<SessionWorkerEnvironment> {
  readonly #journal: DurableCommandJournal
  /** Scene commands use this write-set boundary; the Encounter command cutover is still pending. */
  readonly #roomStore: RoomEncounterStore
  readonly #roomInputs: RoomInputs
  /** D72 per-account buckets for chat, rolls and Scene writes; committed with their command. */
  readonly #buckets: RoomAccountBuckets
  /** Held Character Sheets pushed to their owner and the GM (D73). */
  readonly #sheetFeed: RoomCharacterSheetFeed
  #postCommitQueued = false
  readonly #checkpoints: RoomCheckpoints
  #aggregateNeedsReload = false
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
  readonly #authorization = new RoomAuthorization(({ epoch, known }) => {
    const campaignId = this.#roomCampaignId()
    if (!campaignId) throw new Error('Live Session room identity is missing.')
    return callLiveSessionRoute(this.env, null, 'roomAuthorization', { campaignId, epoch, known })
  })
  /** A background authorization read runs at most once; after a failure, not before this time. */
  #authorizationRefreshing = false
  #authorizationRetryAt = 0
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
  #storageRecovery: Promise<void> | null = null
  #rulesRuntime: Promise<RulesRuntimeService> | null = null
  #sceneSync: Promise<void> | null = null

  constructor(ctx: DurableObjectState, env: SessionWorkerEnvironment) {
    super(ctx, env)
    this.#journal = new DurableCommandJournal(ctx.storage)
    this.#buckets = new RoomAccountBuckets(ctx.storage.sql)
    this.#roomStore = new RoomEncounterStore(ctx.storage, () => this.#queuePostCommit())
    this.#checkpoints = new RoomCheckpoints(
      this.#roomStore,
      ctx.storage,
      (input) => publishRoomCheckpoint(this.env, input),
      (ack) => {
        this.#journal.acknowledgeCheckpointInTransaction({
          authorityEpoch: ack.epoch,
          throughSequence: ack.sequence,
          stateChecksum: ack.checksum
        })
      }
    )
    this.#roomInputs = new RoomInputs(
      this.#roomStore,
      (epoch, scope) => {
        const campaignId = this.#roomCampaignId()
        if (!campaignId) throw new Error('Live Session room identity is missing.')
        return callLiveSessionRoute(this.env, null, 'roomInputs', { campaignId, epoch, scope })
      },
      (manifest) => {
        const campaignId = this.#roomCampaignId()
        if (!campaignId) throw new Error('Live Session room identity is missing.')
        return loadRoomContentSnapshots(this.env, manifest, campaignId)
      }
    )
    this.#sheetFeed = new RoomCharacterSheetFeed({
      store: this.#roomStore,
      inputs: this.#roomInputs,
      authorize: (scope) => this.#authorizationBoundary(scope),
      admission: (socket) => this.#liveAdmission(socket),
      scope: (socket) => {
        const value = attachment(socket)
        return value && this.#journal.readCurrent()?.authorityEpoch === value.authorityEpoch
          ? { authorityEpoch: value.authorityEpoch, campaignId: value.campaignId }
          : null
      },
      send
    })
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
        this.#buckets.deleteUser(parsed.data.operation.userId)
        await this.#refreshIdleRelease()
        return Response.json({ closed })
      }
      if (parsed.data.operation.type === 'INVALIDATE_INPUTS') {
        this.#authorization.invalidate()
        // Membership can end sockets, so it reloads now; other inputs reload before their next use.
        if (parsed.data.operation.scopes.includes('CAMPAIGN'))
          this.ctx.waitUntil(this.#refreshAuthorization().catch(() => undefined))
        return Response.json({ invalidated: true })
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
    if (parsed.data.type === 'UNSUBSCRIBE_CHARACTER_SHEET') {
      this.#sheetFeed.drop(socket)
      return
    }
    if (parsed.data.type === 'SUBSCRIBE_CHARACTER_SHEET') {
      // The push admits the socket: an unauthorized or unheld subscription is dropped there.
      this.#sheetFeed.subscribe(socket, parsed.data.characterId)
      this.#queuePostCommit()
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
          work.message.command.scope === 'CHARACTER_SHEET' ||
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
        .catch((error: unknown) =>
          error instanceof RoomRateLimitedError
            ? this.#rejectCommand(socket, commandId, 'RATE_LIMITED', error.message)
            : this.#rejectCommand(
                socket,
                commandId,
                'UNAVAILABLE',
                'Live Session command unavailable.'
              )
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
    if (await this.#recoverStorageIfNeeded()) {
      await this.#scheduleAlarm()
      return
    }
    const now = Date.now()
    const checkpointAt = this.#checkpointAt()
    if (checkpointAt !== null && checkpointAt <= now) await this.#flushOutbox()
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
    const checkpointAt = this.#checkpointAt()
    if (checkpointAt !== null) deadlines.push(checkpointAt)
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

  #checkpointAt(): number | null {
    const first = this.#journal.oldestUnpublishedCommandTime()
    return first === null ? null : first + ROOM_LIMITS.checkpointDeadlineMs
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
      if (await this.#recoverStorageIfNeeded(value.authorityEpoch)) return
      // Reconnect reads the acknowledged product state after the room's pending prefix is saved.
      await this.#flushOutbox()
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
      await this.#ensureAuthority(
        value,
        accessToken,
        capture.origin.role,
        capture.origin.userId,
        capture.sceneHeader?.id ?? null
      )
      // Each (re-)authentication renews the room's authorization lease with one revisions read.
      const authorization = await this.#refreshAuthorization()
      if (generation !== this.#generations.get(socket)) return
      if (!admitsRoomMember(authorization, capture.origin)) {
        this.#closeIfCurrent(socket, generation, 'Live-session membership changed.')
        return
      }
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
    userId: string,
    sceneId: string | null
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
          if (bootstrap.persistedSequence !== 0) {
            await this.#recoverStorage(value.authorityEpoch)
            throw new Error('Live Session storage was lost; reconnect to its replacement epoch.')
          }
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
        if (current.publishedSequence < bootstrap.persistedSequence) {
          await this.#flushOutbox()
          current = this.#journal.readCurrent()
          if (!current || current.publishedSequence !== bootstrap.persistedSequence)
            throw new Error('Live Session checkpoint recovery is incomplete.')
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
        await this.#loadRoomAggregate(sceneId)
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
    await this.#loadRoomAggregate(sceneId)
  }

  /** Corrupt SQLite or a missing unpublished prefix can only resume under a new Convex fence. */
  async #recoverStorageIfNeeded(fallbackEpoch?: string): Promise<boolean> {
    await this.#commandChain
    if (this.#storageRecovery) {
      await this.#storageRecovery
      return true
    }
    let damaged = this.#roomStore.corruption !== null
    try {
      const current = this.#journal.readCurrent()
      if (current) {
        try {
          hydrateNativeLiveSessionState(current.stateJson)
        } catch {
          damaged = true
        }
      }
      if (current && current.sequence > 0 && this.#roomStore.epoch === null) damaged = true
      if (current && current.sequence !== current.publishedSequence) {
        try {
          this.#roomStore.assertAuthorityHead({
            epoch: current.authorityEpoch,
            sequence: current.sequence,
            checksum: current.stateChecksum
          })
        } catch {
          damaged = true
        }
      }
    } catch (error) {
      if (!(error instanceof DurableCommandJournalError) || error.code !== 'CORRUPT_JOURNAL')
        throw error
      damaged = true
    }
    if (!damaged) return false
    const epoch = this.#journal.authorityEpoch ?? fallbackEpoch
    if (!epoch) throw new Error('Corrupt room storage has no authority fence.')
    await this.#recoverStorage(epoch)
    return true
  }

  /** No abandoned suffix is published; the replacement first hydrates the acknowledged product state. */
  #recoverStorage(epoch: string): Promise<void> {
    if (this.#storageRecovery) return this.#storageRecovery
    this.#closeSockets(
      { type: 'CLOSE_ROOM' },
      'Live Session storage recovered; reconnect to resynchronize.'
    )
    const work = (async () => {
      await this.#commandChain
      if (this.#outboxFlush) await this.#outboxFlush.catch(() => undefined)
      const campaignId = this.#roomCampaignId()
      if (!campaignId) throw new Error('Live Session room identity is missing.')
      const replacement = await callLiveSessionRoute(this.env, null, 'recoverStorage', {
        campaignId,
        epoch
      })
      if (
        replacement.epoch === epoch ||
        replacement.phase !== 'ACTIVATING' ||
        replacement.persistedSequence !== 0
      )
        throw new Error('Live Session storage recovery did not reserve a replacement epoch.')
      const initial = createNativeLiveSessionState()
      this.#roomStore.hydrate({
        epoch: replacement.epoch,
        documents: [],
        records: [],
        checkpoint: { epoch: replacement.epoch, sequence: 0, checksum: initial.stateChecksum },
        commitDurable: () => {
          this.#journal.discardFencedAuthorityInTransaction(epoch)
          this.#checkpoints.discardFencedCheckpointInTransaction()
          this.ctx.storage.sql.exec('DELETE FROM room_idle_release')
          return undefined
        }
      })
      this.#activation = null
      this.#aggregateNeedsReload = true
      this.#authorization.invalidate()
      this.#bumpCacheGeneration()
    })()
    this.#storageRecovery = work
    void work.then(
      () => {
        if (this.#storageRecovery === work) this.#storageRecovery = null
      },
      () => {
        if (this.#storageRecovery === work) this.#storageRecovery = null
      }
    )
    return work
  }

  /** Transitional Convex-first commands reload only after their acknowledged product commit. */
  async #loadRoomAggregate(sceneId: string | null): Promise<void> {
    const current = this.#journal.readCurrent()
    if (!current) throw new Error('Live Session authority changed.')
    if (this.#roomStore.corruption) throw this.#roomStore.corruption
    const sameHead =
      this.#roomStore.epoch === current.authorityEpoch &&
      this.#roomStore.sequence === current.sequence &&
      this.#roomStore.checksum === current.stateChecksum
    if (
      sameHead &&
      !this.#aggregateNeedsReload &&
      this.#roomStore.record('ROOM_INPUT', 'AUTHORITY')
    )
      return
    if (current.sequence !== current.publishedSequence)
      this.#roomStore.assertAuthorityHead({
        epoch: current.authorityEpoch,
        sequence: current.sequence,
        checksum: current.stateChecksum
      })
    if (current.sequence !== current.publishedSequence)
      throw new Error('Room hydration requires an acknowledged authority state.')
    const authorization =
      this.#authorization.currentPlay(current.authorityEpoch) ??
      (await this.#authorization.refresh(current.authorityEpoch))
    await this.#roomInputs.hydrate({
      epoch: current.authorityEpoch,
      encounterId: authorization.play.encounter?.encounterId ?? null,
      sceneId,
      checkpoint: {
        epoch: current.authorityEpoch,
        sequence: current.publishedSequence,
        checksum: current.publishedChecksum
      }
    })
    this.#aggregateNeedsReload = false
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
    let current = this.#journal.readCurrent()
    const commandId = message.command.command.commandId
    if (!value || !current || current.authorityEpoch !== value.authorityEpoch) {
      this.#rejectCommand(socket, commandId, 'AUTHORITY_CHANGED', 'Live Session authority changed.')
      return
    }
    // The command boundary: a stale or expired authorization cache reloads first, which closes the
    // sockets of members who left, so their queued commands never run.
    let authorization: LiveSessionRoomAuthorization
    try {
      authorization = await this.#authorizationBoundary(value)
    } catch {
      this.#rejectCommand(socket, commandId, 'UNAVAILABLE', LIVE_SESSION_TRY_AGAIN_MESSAGE)
      return
    }
    if (this.#liveAdmission(socket)?.generation !== admission.generation) return
    if (!admitsRoomMember(authorization, admission))
      return this.#closeSocket(socket, 'Campaign access ended.')
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
    current = this.#journal.readCurrent()
    if (
      !current ||
      current.authorityEpoch !== value.authorityEpoch ||
      current.status !== 'ACTIVE'
    ) {
      this.#rejectCommand(socket, commandId, 'AUTHORITY_CHANGED', 'Live Session authority changed.')
      return
    }
    if (message.command.scope === 'ENCOUNTER')
      return this.#executeEncounterCommand(socket, admission, value, message.command.command)
    if (message.command.scope === 'ENCOUNTER_BINDING')
      return this.#executeEncounterBinding(socket, admission, value, message.command.command)
    if (message.command.scope === 'CHARACTER_SHEET')
      return this.#executeCharacterSheetCommand(socket, admission, value, message.command)
    if (message.command.scope === 'CAMPAIGN_CHAT')
      return this.#executeCampaignChatCommand(socket, admission, value, message.command)
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
    if (this.#aggregateNeedsReload) {
      try {
        await this.#flushOutbox()
        const candidates = this.ctx.getWebSockets().flatMap((candidateSocket) => {
          const candidate = this.#liveAdmission(candidateSocket)
          return candidate ? [{ admission: candidate, socket: candidateSocket }] : []
        })
        await this.#refreshSceneCache(value, admission, candidates)
        await this.#loadRoomAggregate(this.#cache?.scene?.id ?? null)
        if (this.#cache?.scene) this.#cache = { ...this.#cache, synchronized: true }
      } catch {
        this.#rejectCommand(socket, commandId, 'UNAVAILABLE', LIVE_SESSION_TRY_AGAIN_MESSAGE)
        return
      }
    }
    const synchronized = this.#cache?.synchronized ? this.#cache : null
    const scene = synchronized?.scene ?? null
    const correction = (): LiveSessionCorrectionDto | undefined =>
      scene ? { scope: 'SCENE', state: projectSceneForViewer(scene, viewer(admission)) } : undefined
    if (!this.#buckets.admits(this.#bucket('SCENE', value, admission))) {
      this.#rejectCommand(
        socket,
        commandId,
        'RATE_LIMITED',
        new RoomRateLimitedError().message,
        current.sequence
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
    // A pending movement decision holds token moves, undo and door changes on its Scene (D26).
    if (
      synchronized.encounterId !== null &&
      (await readMovementDecisionPending({ db: this.#roomStore.store }, synchronized.encounterId))
    ) {
      this.#rejectCommand(
        socket,
        commandId,
        'UNAVAILABLE',
        'Waiting on a movement decision.',
        current.sequence,
        correction()
      )
      return
    }

    if (command.type === 'UNDO_LAST_SCENE_MOVE') {
      if (admission.role !== 'OWNER') {
        this.#rejectCommand(
          socket,
          commandId,
          'FORBIDDEN',
          'Only the Campaign owner may undo Scene movement.'
        )
        return
      }
      try {
        await this.#commitRoomUndo(socket, admission, value, command, fingerprint)
      } catch (error) {
        if (error instanceof NoSceneMoveToUndoError)
          this.#rejectCommand(socket, commandId, 'INVALID_COMMAND', error.message)
        else this.#rejectExternal(socket, commandId, error, correction())
      }
      return
    }
    const plan = planLiveSceneCommand({
      actor: admission,
      command,
      encounterId: synchronized.encounterId,
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
      try {
        await this.#commitRoomGeometry(
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

    let nextScene: CampaignSceneStateDto
    let nextUncomposedScene: CampaignSceneStateDto
    try {
      nextScene = applySceneDelta(scene, delta, scene.version + 1)
      if (!synchronized.uncomposedScene || !synchronized.sceneHeader)
        throw new Error('Native Scene persistence inputs are unavailable.')
      nextUncomposedScene = applySceneDelta(synchronized.uncomposedScene, delta, scene.version + 1)
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
    this.#roomStore.assertAuthorityHead({
      epoch: current.authorityEpoch,
      sequence: current.sequence,
      checksum: current.stateChecksum
    })
    const saveId = crypto.randomUUID()
    const header = synchronized.sceneHeader!
    const rawScene = synchronized.uncomposedScene!
    const state = await this.#roomStore.transact(
      (transaction) =>
        Promise.resolve(
          persistRoomSceneCommand({
            transaction,
            header,
            scene: rawScene,
            baseOrdinals: synchronized.baseOrdinals,
            command,
            actorUserId: admission.userId,
            result: expectedSceneResult,
            presentationVersion: synchronized.presentation!.expectedPresentationVersion,
            saveId,
            now: Date.now()
          })
        ),
      (entry) => {
        const authorization = this.#authorization.current(value.authorityEpoch)
        if (
          this.#liveAdmission(socket)?.generation !== admission.generation ||
          !authorization ||
          !admitsRoomMember(authorization, admission)
        )
          throw new Error('Live Session command admission expired before commit.')
        if (entry.sequence !== current.sequence + 1)
          throw new Error('Room command sequence does not match its authority.')
        this.#buckets.charge(this.#bucket('SCENE', value, admission))
        const result = this.#journal.commitInTransaction({
          actorId: admission.userId,
          authorityEpoch: value.authorityEpoch,
          commandId,
          expectedSequence: current.sequence,
          expectedStateChecksum: current.stateChecksum,
          fingerprint,
          nextStateChecksum: entry.chainChecksum,
          nextStateJson: next.stateJson,
          receiptJson: JSON.stringify(committed)
        })
        if (result.kind !== 'COMMITTED')
          throw new Error('Room command unexpectedly replayed inside its write-set transaction.')
      }
    )
    this.#cache = {
      ...synchronized,
      scene: nextScene,
      uncomposedScene: nextUncomposedScene,
      sceneHeader: {
        ...header,
        version: state.version,
        currentCounts: state.counts,
        fogLayerCount: state.fogLayerCount
      },
      synchronized: true
    }
    this.#broadcastSceneCommitted(committed, scene, nextScene, expectedSceneResult, null)
    await this.#scheduleAlarm()
    return
  }

  /**
   * Every ACTIVE-Run Encounter command commits in the room's SQLite (D78); a movement decision
   * settles through the presented Scene's movement path.
   */
  async #executeEncounterCommand(
    socket: WebSocket,
    admission: Admission,
    value: SocketAttachment,
    command: RoomNativeEncounterCommand
  ): Promise<void> {
    // A movement decision the room committed is journaled; its session sequence is not fenced (D28).
    const fingerprint = roomEncounterCommandFingerprint(command)
    let movementResponse = false
    if (command.type === 'RESOLVE_RULE_OCCURRENCE' || command.type === 'VOID_RULE_OCCURRENCE') {
      try {
        if (this.#aggregateNeedsReload) await this.#flushOutbox()
        await this.#loadRoomAggregate(this.#cache?.scene?.id ?? null)
        movementResponse =
          (await readRoomEncounterResponseRoute(this.#roomStore, command)) === 'MOVEMENT' &&
          (command.type === 'RESOLVE_RULE_OCCURRENCE' ||
            !(await roomOwnsEncounterVoid(this.#roomStore, command)))
      } catch {
        this.#rejectCommand(
          socket,
          command.commandId,
          'UNAVAILABLE',
          LIVE_SESSION_TRY_AGAIN_MESSAGE
        )
        return
      }
    }
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
      if (replay.type === 'COMMAND_COMMITTED' && replay.delta?.scope === 'ENCOUNTER') {
        try {
          if (
            prior.receipt.checkpointBeforeAcknowledgement &&
            prior.receipt.sequence > (this.#journal.readCurrent()?.publishedSequence ?? 0)
          )
            await this.#checkpointThrough(value.authorityEpoch, prior.receipt.sequence)
          await this.#loadRoomAggregate(this.#cache?.scene?.id ?? null)
          const authorization = await this.#authorizationBoundary(value)
          if (
            this.#liveAdmission(socket)?.generation !== admission.generation ||
            !admitsRoomMember(authorization, admission)
          )
            return
          const result = await replayRoomEncounterCommand({
            store: this.#roomStore,
            inputs: this.#roomInputs,
            authorization,
            userId: admission.userId,
            result: replay.delta.result
          })
          send(socket, {
            ...replay,
            sequence:
              result.projection.version === replay.delta.result.projection.version
                ? replay.sequence
                : (this.#journal.readCurrent()?.sequence ?? replay.sequence),
            delta: { scope: 'ENCOUNTER', result }
          })
        } catch {
          this.#rejectCommand(
            socket,
            command.commandId,
            'UNAVAILABLE',
            LIVE_SESSION_TRY_AGAIN_MESSAGE
          )
        }
      } else
        this.#rejectCommand(
          socket,
          command.commandId,
          'STALE_STATE',
          'This decision was already settled.'
        )
      return
    }
    if (
      movementResponse &&
      (command.type === 'RESOLVE_RULE_OCCURRENCE' || command.type === 'VOID_RULE_OCCURRENCE')
    ) {
      try {
        const result = await this.#commitMovementDecision(
          socket,
          admission,
          value,
          command,
          fingerprint,
          this.#captureCache.reads()
        )
        if (this.#liveAdmission(socket)?.generation === admission.generation)
          send(socket, {
            commandId: command.commandId,
            delta: { scope: 'ENCOUNTER', result },
            sequence: this.#journal.readCurrent()?.sequence ?? 0,
            type: 'COMMAND_COMMITTED'
          })
      } catch (error) {
        this.#rejectExternal(socket, command.commandId, error, undefined)
      }
      return
    }
    return this.#executeLocalEncounterCommand(socket, admission, value, command, fingerprint)
  }

  /** Held Sheet play, its private history and the journal receipt commit before acknowledgement. */
  async #executeCharacterSheetCommand(
    socket: WebSocket,
    admission: Admission,
    value: SocketAttachment,
    command: Extract<LiveSessionCommandDto, { scope: 'CHARACTER_SHEET' }>
  ): Promise<void> {
    const commandId = command.command.commandId
    const fingerprint = checksumCanonicalJson(command)
    try {
      if (this.#aggregateNeedsReload) await this.#flushOutbox()
      await this.#loadRoomAggregate(this.#cache?.scene?.id ?? null)
      const current = this.#journal.readCurrent()
      if (
        !current ||
        current.authorityEpoch !== value.authorityEpoch ||
        current.status !== 'ACTIVE'
      )
        throw new Error('Live Session authority changed.')
      const authorization = await this.#authorizationBoundary(value)
      if (
        this.#liveAdmission(socket)?.generation !== admission.generation ||
        !admitsRoomMember(authorization, admission)
      )
        return
      const assigned = authorization.campaign.assignments.find(
        (entry) => entry.characterId === command.characterId.toLowerCase()
      )
      const character = authorization.characters.find(
        (entry) => entry.characterId === command.characterId.toLowerCase()
      )
      if (
        !assigned ||
        !character ||
        assigned.userId !== character.ownerUserId ||
        (admission.role !== 'OWNER' && assigned.userId !== admission.userId)
      )
        throw new CharacterSheetCommandError('Assigned Character not found.')
      if (character.ownerUserId !== admission.userId)
        assertCampaignGmSheetCommandAllowed(command.command)
      this.#roomStore.assertAuthorityHead({
        epoch: current.authorityEpoch,
        sequence: current.sequence,
        checksum: current.stateChecksum
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
          'The command ID was already used for different input.'
        )
        return
      }
      if (prior.kind === 'REPLAY') {
        const receipt = liveSessionWebSocketServerMessageDtoSchema.parse(
          JSON.parse(prior.receipt.receiptJson)
        )
        if (
          receipt.type !== 'COMMAND_COMMITTED' ||
          receipt.delta?.scope !== 'CHARACTER_SHEET' ||
          receipt.delta.result.characterId !== character.characterId
        )
          throw new Error('Stored Character Sheet receipt scope mismatch.')
        const run = await this.#roomStore.store
          .query('encounterRuns')
          .withIndex('by_publicId', (query) => query.eq('id', command.encounterId.toLowerCase()))
          .unique()
        if (!run) throw new CharacterSheetCommandError('Encounter is unavailable.')
        const state = readRunState(run)
        if (
          state.status !== 'ACTIVE' ||
          state.campaignId !== value.campaignId ||
          !(await readRunActors({ db: this.#roomStore.store }, state)).some(
            (actor) =>
              actor.kind === 'CHARACTER' &&
              actor.sourceId === character.characterId &&
              actor.frozenState === null
          )
        )
          throw new CharacterSheetCommandError('Character is not held by this active Encounter.')
        // Member admission above already requires an ACTIVE Campaign: archived Campaigns have no members.
        const [play, campaignPlay] = await Promise.all([
          this.#roomStore.store
            .query('characterPlayStates')
            .withIndex('by_characterId', (query) => query.eq('characterId', character.characterId))
            .unique(),
          this.#roomInputs.play(
            this.#roomInputs.revisions(value.campaignId, authorization.revisions)
          )
        ])
        if (
          !play ||
          campaignPlay.campaign.id !== value.campaignId ||
          state.gameSystemId !== campaignPlay.campaign.gameSystemId ||
          play.userId !== character.ownerUserId
        )
          throw new Error('Current Character Sheet replay scope mismatch.')
        readCharacterPlay(play)
        const result = await readCharacterCommandReplay(
          {
            characterId: character.characterId,
            userId: admission.userId,
            command: command.command,
            streamVersion: play.streamVersion,
            contentMaturity: campaignPlay.campaign.contentMaturity,
            viewer:
              character.ownerUserId === admission.userId ? 'CHARACTER_OWNER' : 'CAMPAIGN_OWNER'
          },
          () =>
            this.#roomStore.store
              .query('characterCommandReceipts')
              .withIndex('by_characterId_commandId', (query) =>
                query
                  .eq('characterId', character.characterId)
                  .eq('commandId', commandId.toLowerCase())
              )
              .unique()
        )
        if (
          !result ||
          result.historyEntry?.eventType !== command.command.type ||
          result.historyEntry?.eventId !== receipt.delta.result.historyEntry?.eventId
        )
          throw new Error('Stored Character Sheet replay identity mismatch.')
        send(socket, {
          ...receipt,
          sequence:
            result.streamVersion === receipt.delta.result.streamVersion
              ? receipt.sequence
              : current.sequence,
          delta: { scope: 'CHARACTER_SHEET', result }
        })
        return
      }
      const sceneCache = this.#cache
      let receipt: LiveSessionWebSocketServerMessageDto | null = null
      let nextStateJson = current.stateJson
      const result = await this.#roomStore.transact(
        async (transaction) => {
          const executed = await executeRoomCharacterSheetCommand({
            store: this.#roomStore,
            transaction,
            inputs: this.#roomInputs,
            authorization,
            campaignId: value.campaignId,
            epoch: value.authorityEpoch,
            userId: admission.userId,
            command
          })
          const composition = sceneCache?.uncomposedScene
            ? await composeRoomSceneVision({
                store: this.#roomStore,
                transaction,
                inputs: this.#roomInputs,
                authorization,
                campaignId: value.campaignId,
                epoch: value.authorityEpoch,
                scene: sceneCache.uncomposedScene,
                encounterIds: [
                  ...new Set([
                    ...sceneCache.visionEncounterIds,
                    ...(sceneCache.encounterId ? [sceneCache.encounterId] : [])
                  ])
                ]
              })
            : null
          if (composition) nextStateJson = createNativeLiveSessionState(composition.scene).stateJson
          receipt = liveSessionWebSocketServerMessageDtoSchema.parse({
            type: 'COMMAND_COMMITTED',
            commandId,
            sequence: current.sequence + 1,
            delta: { scope: 'CHARACTER_SHEET', result: executed.acknowledgement }
          })
          return { ...executed, composition }
        },
        (entry) => {
          const latest = this.#authorization.current(value.authorityEpoch)
          if (
            this.#liveAdmission(socket)?.generation !== admission.generation ||
            !latest ||
            !admitsRoomMember(latest, admission) ||
            checksumCanonicalJson(latest.revisions) !==
              checksumCanonicalJson(authorization.revisions) ||
            this.#cache !== sceneCache ||
            this.#presentationChanging
          )
            throw new Error('Live Session command admission expired before commit.')
          if (!receipt || entry.sequence !== current.sequence + 1)
            throw new Error('Room Sheet command sequence does not match its authority.')
          const committed = this.#journal.commitInTransaction({
            actorId: admission.userId,
            authorityEpoch: value.authorityEpoch,
            commandId,
            fingerprint,
            expectedSequence: current.sequence,
            expectedStateChecksum: current.stateChecksum,
            nextStateChecksum: entry.chainChecksum,
            nextStateJson,
            receiptJson: JSON.stringify(receipt)
          })
          if (committed.kind !== 'COMMITTED')
            throw new Error(
              'Room Sheet command unexpectedly replayed inside its write transaction.'
            )
        }
      )
      this.#authorization.applyCharacters(
        value.authorityEpoch,
        authorization.characters.map((entry) =>
          entry.characterId === character.characterId
            ? { ...entry, partyVisibility: result.facts.sheetState.partyVisibility }
            : entry
        )
      )
      if (result.composition && sceneCache)
        this.#cache = {
          ...sceneCache,
          scene: result.composition.scene,
          characterRevisions: result.composition.characterRevisions
        }
      if (!receipt) throw new Error('Room Sheet command receipt is unavailable.')
      for (const recipient of this.ctx.getWebSockets()) {
        const member = this.#liveAdmission(recipient)
        if (!member || !admitsRoomMember(authorization, member)) continue
        // Character history is private; every member still advances the same room sequence.
        send(
          recipient,
          member.userId === admission.userId
            ? receipt
            : {
                type: 'COMMAND_COMMITTED',
                commandId,
                delta: null,
                sequence: this.#journal.readCurrent()!.sequence
              }
        )
      }
      if (
        result.composition &&
        (command.command.type === 'SET_PARTY_VISIBILITY' ||
          !equalCanonicalJson(sceneCache?.scene?.tokens, result.composition.scene.tokens))
      )
        this.#broadcastStateSync()
      await this.#scheduleAlarm()
    } catch (error) {
      if (error instanceof CharacterSheetCommandError) {
        this.#rejectCommand(socket, commandId, 'DOMAIN_REJECTED', error.message)
        return
      }
      const refusal = encounterCommandRefusal(error)
      this.#rejectCommand(socket, commandId, refusal.code, refusal.message)
    }
  }

  #bucket(kind: AccountBucketKind, value: SocketAttachment, admission: Admission) {
    return {
      epoch: value.authorityEpoch,
      kind,
      role: admission.role,
      userId: admission.userId
    } as const
  }

  /**
   * General chat and Campaign rolls (D69): the entry fans out to its conversation immediately and
   * reaches Convex with the room's next checkpoint. The D72 charge, the journal receipt and the
   * records commit together, so an exact retry replays the original entry for free.
   */
  async #executeCampaignChatCommand(
    socket: WebSocket,
    admission: Admission,
    value: SocketAttachment,
    command: Extract<LiveSessionCommandDto, { scope: 'CAMPAIGN_CHAT' }>
  ): Promise<void> {
    const commandId = command.command.commandId
    const fingerprint = checksumCanonicalJson(command)
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
    try {
      const bucket = this.#bucket('TABLE', value, admission)
      if (!this.#buckets.admits(bucket)) throw new RoomRateLimitedError()
      if (this.#aggregateNeedsReload) await this.#flushOutbox()
      await this.#loadRoomAggregate(this.#cache?.scene?.id ?? null)
      const current = this.#journal.readCurrent()
      if (
        !current ||
        current.authorityEpoch !== value.authorityEpoch ||
        current.status !== 'ACTIVE'
      )
        throw new Error('Live Session authority changed.')
      const authorization = await this.#authorizationBoundary(value)
      if (
        this.#liveAdmission(socket)?.generation !== admission.generation ||
        !admitsRoomMember(authorization, admission)
      )
        return
      this.#roomStore.assertAuthorityHead({
        epoch: current.authorityEpoch,
        sequence: current.sequence,
        checksum: current.stateChecksum
      })
      let receipt: LiveSessionWebSocketServerMessageDto | null = null
      const executed = await this.#roomStore.transact(
        async (transaction) => {
          const posted = await executeRoomCampaignChatCommand({
            store: this.#roomStore,
            transaction,
            inputs: this.#roomInputs,
            authorization,
            campaignId: value.campaignId,
            epoch: value.authorityEpoch,
            userId: admission.userId,
            command: command.command
          })
          receipt = liveSessionWebSocketServerMessageDtoSchema.parse({
            type: 'COMMAND_COMMITTED',
            commandId,
            sequence: current.sequence + 1,
            delta: { scope: 'CAMPAIGN_CHAT', entry: posted.entry }
          })
          return posted
        },
        (entry) => {
          const latest = this.#authorization.current(value.authorityEpoch)
          if (
            this.#liveAdmission(socket)?.generation !== admission.generation ||
            !latest ||
            !admitsRoomMember(latest, admission) ||
            checksumCanonicalJson(latest.revisions) !==
              checksumCanonicalJson(authorization.revisions)
          )
            throw new Error('Live Session command admission expired before commit.')
          if (!receipt || entry.sequence !== current.sequence + 1)
            throw new Error('Room chat command sequence does not match its authority.')
          this.#buckets.charge(bucket)
          const committed = this.#journal.commitInTransaction({
            actorId: admission.userId,
            authorityEpoch: value.authorityEpoch,
            commandId,
            fingerprint,
            expectedSequence: current.sequence,
            expectedStateChecksum: current.stateChecksum,
            nextStateChecksum: entry.chainChecksum,
            nextStateJson: current.stateJson,
            receiptJson: JSON.stringify(receipt)
          })
          if (committed.kind !== 'COMMITTED')
            throw new Error('Room chat command unexpectedly replayed inside its transaction.')
        }
      )
      if (!receipt) throw new Error('Room chat command receipt is unavailable.')
      for (const recipient of this.ctx.getWebSockets()) {
        const member = this.#liveAdmission(recipient)
        if (!member || !admitsRoomMember(authorization, member)) continue
        // Every member advances the same room sequence; only the conversation reads the entry.
        send(
          recipient,
          executed.recipientUserIds.includes(member.userId)
            ? member.userId === admission.userId
              ? receipt
              : {
                  type: 'COMMAND_COMMITTED',
                  commandId,
                  sequence: current.sequence + 1,
                  delta: { scope: 'CAMPAIGN_CHAT', entry: executed.entry }
                }
            : {
                type: 'COMMAND_COMMITTED',
                commandId,
                sequence: current.sequence + 1,
                delta: null
              }
        )
      }
      await this.#scheduleAlarm()
    } catch (error) {
      if (error instanceof RoomRateLimitedError)
        this.#rejectCommand(socket, commandId, 'RATE_LIMITED', error.message)
      else if (error instanceof CampaignChatCommandError)
        this.#rejectCommand(socket, commandId, 'DOMAIN_REJECTED', error.message)
      else {
        const refusal = encounterCommandRefusal(error)
        this.#rejectCommand(socket, commandId, refusal.code, refusal.message)
      }
    }
  }

  async #executeLocalEncounterCommand(
    socket: WebSocket,
    admission: Admission,
    value: SocketAttachment,
    command: RoomNativeEncounterCommand,
    fingerprint: string
  ): Promise<void> {
    // A roll posted to the table spends the same D72 allowance as chat and Campaign rolls.
    const tableBucket =
      command.type === 'ROLL_RULE_EVIDENCE' ||
      (command.type === 'ROLL_ENEMY_ACTION' && command.visibility === 'TABLE')
        ? this.#bucket('TABLE', value, admission)
        : null
    try {
      if (tableBucket && !this.#buckets.admits(tableBucket)) throw new RoomRateLimitedError()
      if (this.#aggregateNeedsReload) await this.#flushOutbox()
      await this.#loadRoomAggregate(this.#cache?.scene?.id ?? null)
      const current = this.#journal.readCurrent()
      if (
        !current ||
        current.authorityEpoch !== value.authorityEpoch ||
        current.status !== 'ACTIVE'
      )
        throw new Error('Live Session authority changed.')
      const authorization = await this.#authorizationBoundary(value)
      if (
        this.#liveAdmission(socket)?.generation !== admission.generation ||
        !admitsRoomMember(authorization, admission)
      )
        return
      this.#roomStore.assertAuthorityHead({
        epoch: current.authorityEpoch,
        sequence: current.sequence,
        checksum: current.stateChecksum
      })
      const recipients = this.ctx.getWebSockets().flatMap((candidate) => {
        const member = this.#liveAdmission(candidate)
        return member && admitsRoomMember(authorization, member) ? [member.userId] : []
      })
      let receipt: LiveSessionWebSocketServerMessageDto | null = null
      let checkpointBeforeAcknowledgement = false
      let nextSceneStateJson = current.stateJson
      const sceneCache = this.#cache
      const result = await this.#roomStore.transact(
        async (transaction) => {
          const result = await executeRoomEncounterCommand({
            store: this.#roomStore,
            transaction,
            inputs: this.#roomInputs,
            authorization,
            campaignId: value.campaignId,
            epoch: value.authorityEpoch,
            userId: admission.userId,
            recipientUserIds: recipients,
            command,
            presentedSceneId: sceneCache?.scene?.id ?? null,
            random: secureRandomInt,
            ...(command.type === 'START' ||
            command.type === 'ADVANCE_TURN' ||
            command.type === 'RESOLVE_ACTION' ||
            command.type === 'RESOLVE_RULE_OCCURRENCE' ||
            command.type === 'VOID_RULE_OCCURRENCE' ||
            command.type === 'USE_BASIC_ACTION'
              ? {
                  turnExecution: {
                    environment: this.env,
                    runtime: await this.#liveRulesRuntime(),
                    captures: this.#captureCache.reads()
                  }
                }
              : {})
          })
          const ownResult = result.recipients.get(admission.userId)
          if (!ownResult) throw new Error('Room command has no admitted recipient result.')
          checkpointBeforeAcknowledgement = result.checkpointBeforeAcknowledgement
          receipt = liveSessionWebSocketServerMessageDtoSchema.parse({
            type: 'COMMAND_COMMITTED',
            commandId: command.commandId,
            sequence: current.sequence + 1,
            delta: { scope: 'ENCOUNTER', result: ownResult }
          })
          const composition = sceneCache?.uncomposedScene
            ? await composeRoomSceneVision({
                store: this.#roomStore,
                transaction,
                inputs: this.#roomInputs,
                authorization,
                campaignId: value.campaignId,
                epoch: value.authorityEpoch,
                scene: sceneCache.uncomposedScene,
                encounterIds: [
                  ...new Set([
                    ...sceneCache.visionEncounterIds,
                    ...(sceneCache.encounterId ? [sceneCache.encounterId] : [])
                  ])
                ]
              })
            : null
          if (composition)
            nextSceneStateJson = createNativeLiveSessionState(composition.scene).stateJson
          return { ...result, composition }
        },
        (entry) => {
          const latest = this.#authorization.current(value.authorityEpoch)
          if (
            this.#liveAdmission(socket)?.generation !== admission.generation ||
            !latest ||
            checksumCanonicalJson(latest.revisions) !==
              checksumCanonicalJson(authorization.revisions) ||
            !admitsRoomMember(latest, admission)
          )
            throw new Error('Live Session command admission expired before commit.')
          if (!receipt || entry.sequence !== current.sequence + 1)
            throw new Error('Room command sequence does not match its authority.')
          if (tableBucket) this.#buckets.charge(tableBucket)
          const committed = this.#journal.commitInTransaction({
            actorId: admission.userId,
            authorityEpoch: value.authorityEpoch,
            commandId: command.commandId,
            fingerprint,
            expectedSequence: current.sequence,
            expectedStateChecksum: current.stateChecksum,
            nextStateChecksum: entry.chainChecksum,
            nextStateJson: nextSceneStateJson,
            receiptJson: JSON.stringify(receipt),
            checkpointBeforeAcknowledgement
          })
          if (committed.kind !== 'COMMITTED')
            throw new Error('Room command unexpectedly replayed inside its write-set transaction.')
        }
      )
      if (result.play) this.#authorization.applyPlay(value.authorityEpoch, result.play)
      if (result.composition && sceneCache) {
        this.#cache = {
          ...sceneCache,
          scene: result.composition.scene,
          characterRevisions: result.composition.characterRevisions
        }
        if (!equalCanonicalJson(sceneCache.scene?.tokens, result.composition.scene.tokens))
          this.#broadcastStateSync()
      }
      if (result.checkpointBeforeAcknowledgement)
        await this.#checkpointThrough(value.authorityEpoch, current.sequence + 1)
      const latest = await this.#authorizationBoundary(value)
      for (const recipientSocket of this.ctx.getWebSockets()) {
        const member = this.#liveAdmission(recipientSocket)
        if (!member || !latest || !admitsRoomMember(latest, member)) continue
        const projection = result.recipients.get(member.userId)
        if (projection)
          send(recipientSocket, {
            type: 'COMMAND_COMMITTED',
            commandId: command.commandId,
            sequence: current.sequence + 1,
            delta: { scope: 'ENCOUNTER', result: projection }
          })
      }
      await this.#scheduleAlarm()
    } catch (error) {
      if (
        error instanceof EncounterDomainRejection ||
        error instanceof LiveSessionDomainRejectionError
      ) {
        const rejection = error instanceof EncounterDomainRejection ? error.data : error.rejection
        send(socket, {
          code: 'DOMAIN_REJECTED',
          commandId: command.commandId,
          currentSequence: this.#journal.readCurrent()?.sequence ?? 0,
          message: rejection.message,
          reason: rejection.reason,
          warnings: rejection.reason === 'RULE_WARNINGS' ? rejection.warnings : null,
          type: 'COMMAND_REJECTED'
        })
        return
      }
      if (error instanceof RoomRateLimitedError)
        this.#rejectCommand(socket, command.commandId, 'RATE_LIMITED', error.message)
      else if (error instanceof CharacterSheetCommandError)
        this.#rejectCommand(socket, command.commandId, 'DOMAIN_REJECTED', error.message)
      else {
        const refusal = encounterCommandRefusal(error)
        this.#rejectCommand(socket, command.commandId, refusal.code, refusal.message)
      }
    }
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
    captures: LiveCaptureReads | undefined
  ): Promise<EncounterCommandResultDto> {
    if (this.#cache?.synchronized && this.#cache.encounterId !== command.encounterId.toLowerCase())
      throw sceneNotPresentedRejection()
    const { encounter } = await this.#commitRoomGeometry(
      socket,
      admission,
      value,
      command,
      fingerprint,
      captures
    )
    if (!encounter) throw new Error('A movement decision commit returned no Encounter result.')
    return encounter
  }

  /** Geometry, fog, rules, replay evidence and acknowledgement commit in one SQLite transaction. */
  async #commitRoomUndo(
    socket: WebSocket,
    admission: Admission,
    value: SocketAttachment,
    command: SceneUndoExecuteInput['input'],
    fingerprint: string
  ): Promise<void> {
    if (this.#aggregateNeedsReload) await this.#flushOutbox()
    await this.#loadRoomAggregate(command.sceneId)
    const cache = this.#cache?.synchronized ? this.#cache : null
    const current = this.#journal.readCurrent()
    if (
      !cache?.scene ||
      !cache.uncomposedScene ||
      !cache.presentation ||
      !current ||
      current.authorityEpoch !== value.authorityEpoch
    )
      throw new LiveSessionRouteError(409)
    const before = cache.scene
    const authorization = await this.#authorizationBoundary(value)
    if (!admitsRoomMember(authorization, admission)) throw new Error('Room undo admission expired.')
    this.#roomStore.assertAuthorityHead({
      epoch: current.authorityEpoch,
      sequence: current.sequence,
      checksum: current.stateChecksum
    })
    let receipt: LiveSessionWebSocketServerMessageDto | null = null
    let nextStateJson: string | null = null
    const sequence = current.sequence + 1
    const committed = await this.#roomStore.transact(
      async (transaction) => {
        const undo = await publishRoomSceneUndo({
          transaction,
          userId: admission.userId,
          scene: cache.uncomposedScene!,
          request: { input: command, presentation: cache.presentation! }
        })
        const composition = await composeRoomSceneVision({
          store: this.#roomStore,
          transaction,
          inputs: this.#roomInputs,
          authorization,
          campaignId: value.campaignId,
          epoch: value.authorityEpoch,
          scene: undo.scene,
          encounterIds: [
            ...new Set([
              ...cache.visionEncounterIds,
              ...(cache.encounterId ? [cache.encounterId] : [])
            ])
          ]
        })
        nextStateJson = createNativeLiveSessionState(composition.scene).stateJson
        receipt = liveSessionWebSocketServerMessageDtoSchema.parse({
          commandId: command.commandId,
          type: 'COMMAND_COMMITTED',
          sequence,
          delta: { scope: 'SCENE', result: undo.result }
        })
        return { ...undo, composition }
      },
      (entry) => {
        const latest = this.#authorization.current(value.authorityEpoch)
        if (
          !latest ||
          this.#liveAdmission(socket)?.generation !== admission.generation ||
          !admitsRoomMember(latest, admission) ||
          checksumCanonicalJson(latest.revisions) !==
            checksumCanonicalJson(authorization.revisions) ||
          this.#cache?.scene?.id !== before.id ||
          this.#cache.scene.version !== before.version ||
          this.#cache.presentation?.expectedPresentationVersion !==
            cache.presentation!.expectedPresentationVersion
        )
          throw new Error('Room undo admission expired before commit.')
        if (!receipt || !nextStateJson || entry.sequence !== sequence)
          throw new Error('Room undo sequence does not match its authority.')
        this.#buckets.charge(this.#bucket('SCENE', value, admission))
        const result = this.#journal.commitInTransaction({
          actorId: admission.userId,
          authorityEpoch: value.authorityEpoch,
          commandId: command.commandId,
          fingerprint,
          expectedSequence: current.sequence,
          expectedStateChecksum: current.stateChecksum,
          nextStateChecksum: entry.chainChecksum,
          nextStateJson,
          receiptJson: JSON.stringify(receipt)
        })
        if (result.kind !== 'COMMITTED')
          throw new Error('Room undo unexpectedly replayed inside its transaction.')
      }
    )
    this.#cache = {
      ...cache,
      scene: committed.composition.scene,
      uncomposedScene: committed.scene,
      sceneHeader: committed.header,
      characterRevisions: committed.composition.characterRevisions
    }
    this.#broadcastSceneCommitted(
      { commandId: command.commandId, sequence },
      before,
      committed.composition.scene,
      committed.result,
      null
    )
    if (committed.fogChanged) this.#broadcastStateSync()
    await this.#scheduleAlarm()
  }

  /** Geometry, fog, rules, replay evidence and acknowledgement commit in one SQLite transaction. */
  async #commitRoomGeometry(
    socket: WebSocket,
    admission: Admission,
    value: SocketAttachment,
    command: ExternalSceneCommand,
    fingerprint: string,
    captures: LiveCaptureReads | undefined
  ) {
    if (this.#aggregateNeedsReload) await this.#flushOutbox()
    await this.#loadRoomAggregate(this.#cache?.scene?.id ?? null)
    const context = this.#externalSceneContext()
    if (!context) throw new LiveSessionRouteError(409)
    const before = context.scene
    const cache = this.#cache!
    if (!cache.uncomposedScene) throw new Error('Native Scene persistence inputs are unavailable.')
    const current = this.#journal.readCurrent()
    if (
      !current ||
      current.authorityEpoch !== value.authorityEpoch ||
      this.#cache?.scene?.id !== before.id ||
      this.#cache.scene.version !== before.version
    )
      throw new LiveSessionRouteError(409)
    const authorization = await this.#authorizationBoundary(value)
    if (
      this.#liveAdmission(socket)?.generation !== admission.generation ||
      !admitsRoomMember(authorization, admission)
    )
      throw new Error('Live Session command admission expired.')
    this.#roomStore.assertAuthorityHead({
      epoch: current.authorityEpoch,
      sequence: current.sequence,
      checksum: current.stateChecksum
    })
    const sequence = current.sequence + 1
    let receipt: LiveSessionWebSocketServerMessageDto | null = null
    let nextStateJson: string | null = null
    const committed = await this.#roomStore.transact(
      async (transaction) => {
        const result = await executeRoomSceneGeometry({
          store: this.#roomStore,
          transaction,
          inputs: this.#roomInputs,
          authorization,
          campaignId: value.campaignId,
          epoch: value.authorityEpoch,
          userId: admission.userId,
          command,
          context,
          environment: this.env,
          runtime: await this.#liveRulesRuntime(),
          captures: captures ?? this.#captureCache.reads(),
          random: secureRandomInt
        })
        // The fog patches are written by their owners; the acknowledged DTO carries none.
        const scene = sceneCommandResultDtoSchema.parse({
          commandId: result.scene.commandId,
          delta: result.scene.delta,
          occurrence: result.scene.occurrence,
          replayed: result.scene.replayed,
          sceneId: result.scene.sceneId,
          version: result.scene.version
        })
        receipt = liveSessionWebSocketServerMessageDtoSchema.parse({
          commandId: command.commandId,
          delta: result.encounter
            ? { scope: 'ENCOUNTER', result: result.encounter }
            : { scope: 'SCENE', result: scene },
          sequence,
          type: 'COMMAND_COMMITTED'
        })
        const raw = result.scene.delta
          ? applySceneDelta(cache.uncomposedScene!, result.scene.delta, result.nextScene.version)
          : cache.uncomposedScene!
        const uncomposedScene = {
          ...raw,
          version: result.nextScene.version,
          fogLayers: result.nextScene.fogLayers
        }
        const composition = await composeRoomSceneVision({
          store: this.#roomStore,
          transaction,
          inputs: this.#roomInputs,
          authorization,
          campaignId: value.campaignId,
          epoch: value.authorityEpoch,
          scene: uncomposedScene,
          encounterIds: [
            ...new Set([
              ...cache.visionEncounterIds,
              ...(cache.encounterId ? [cache.encounterId] : [])
            ])
          ]
        })
        nextStateJson = createNativeLiveSessionState(composition.scene).stateJson
        return {
          ...result,
          scene,
          nextScene: composition.scene,
          uncomposedScene,
          characterRevisions: composition.characterRevisions,
          header: readRoomSceneHeader(transaction, before.id),
          play: await readRoomEncounterPlayAuthorization(
            { db: this.#roomStore.store },
            value.campaignId,
            authorization.play
          )
        }
      },
      (entry) => {
        const latest = this.#authorization.current(value.authorityEpoch)
        if (
          this.#liveAdmission(socket)?.generation !== admission.generation ||
          !latest ||
          checksumCanonicalJson(latest.revisions) !==
            checksumCanonicalJson(authorization.revisions) ||
          !admitsRoomMember(latest, admission) ||
          this.#cache?.scene?.id !== before.id ||
          this.#cache.scene.version !== before.version ||
          this.#cache.presentation?.expectedPresentationVersion !==
            context.presentation.expectedPresentationVersion
        )
          throw new Error('Live Session command admission expired before commit.')
        if (!receipt || !nextStateJson || entry.sequence !== sequence)
          throw new Error('Room command sequence does not match its authority.')
        this.#buckets.charge(this.#bucket('SCENE', value, admission))
        const result = this.#journal.commitInTransaction({
          actorId: admission.userId,
          authorityEpoch: value.authorityEpoch,
          commandId: command.commandId,
          fingerprint,
          expectedSequence: current.sequence,
          expectedStateChecksum: current.stateChecksum,
          nextStateChecksum: entry.chainChecksum,
          nextStateJson,
          receiptJson: JSON.stringify(receipt)
        })
        if (result.kind !== 'COMMITTED')
          throw new Error('Room command unexpectedly replayed inside its write-set transaction.')
      }
    )
    if (committed.play) this.#authorization.applyPlay(value.authorityEpoch, committed.play)
    this.#cache = {
      ...cache,
      scene: committed.nextScene,
      uncomposedScene: committed.uncomposedScene,
      characterRevisions: committed.characterRevisions,
      sceneHeader: committed.header
    }
    this.#broadcastSceneCommitted(
      { commandId: command.commandId, sequence },
      before,
      committed.nextScene,
      committed.scene,
      socket
    )
    if (committed.fogChanged || !equalCanonicalJson(before.tokens, committed.nextScene.tokens))
      this.#broadcastStateSync()
    await this.#scheduleAlarm()
    return committed
  }

  /**
   * The room's synchronized presented Scene that geometry commands plan against; null until the
   * Scene is synchronized.
   */
  #externalSceneContext(): ExternalSceneContext | null {
    const synchronized = this.#cache?.synchronized ? this.#cache : null
    if (!synchronized?.scene || !synchronized.presentation) return null
    return {
      scene: synchronized.scene,
      baseOrdinals: synchronized.baseOrdinals,
      characterRevisions: synchronized.characterRevisions,
      presentation: synchronized.presentation
    }
  }

  /** The GM's binding, native controls and room receipt commit together before fanout. */
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
      if (this.#aggregateNeedsReload) await this.#flushOutbox()
      await this.#loadRoomAggregate(sceneId)
      const current = this.#journal.readCurrent()
      if (!current || current.authorityEpoch !== value.authorityEpoch)
        throw new LiveSessionRouteError(409)
      const authorization = await this.#authorizationBoundary(value)
      if (
        !synchronized.uncomposedScene ||
        this.#liveAdmission(socket)?.generation !== admission.generation ||
        !admitsRoomMember(authorization, admission)
      )
        throw new Error('Live Session binding admission expired.')
      this.#roomStore.assertAuthorityHead({
        epoch: current.authorityEpoch,
        sequence: current.sequence,
        checksum: current.stateChecksum
      })
      const sequence = current.sequence + 1
      let receipt: LiveSessionWebSocketServerMessageDto | null = null
      let nextStateJson: string | null = null
      const result = await this.#roomStore.transact(
        async (transaction) => {
          const bound = await executeRoomSceneBinding({
            store: this.#roomStore,
            transaction,
            inputs: this.#roomInputs,
            authorization,
            campaignId: value.campaignId,
            epoch: value.authorityEpoch,
            userId: admission.userId,
            sceneId,
            expectedPresentationVersion: presentation.expectedPresentationVersion,
            command
          })
          const encounterId =
            bound.result.sceneId === sceneId ? bound.result.encounterId : synchronized.encounterId
          const encounterIds = [
            ...new Set([...synchronized.visionEncounterIds, ...(encounterId ? [encounterId] : [])])
          ]
          const composition = await composeRoomSceneVision({
            store: this.#roomStore,
            transaction,
            inputs: this.#roomInputs,
            authorization,
            campaignId: value.campaignId,
            epoch: value.authorityEpoch,
            scene: synchronized.uncomposedScene!,
            encounterIds
          })
          nextStateJson = createNativeLiveSessionState(composition.scene).stateJson
          receipt = liveSessionWebSocketServerMessageDtoSchema.parse({
            commandId,
            delta: { scope: 'ENCOUNTER_BINDING', result: bound.result },
            sequence,
            type: 'COMMAND_COMMITTED'
          })
          return { ...bound, encounterId, encounterIds, composition }
        },
        (entry) => {
          const latest = this.#authorization.current(value.authorityEpoch)
          if (
            !latest ||
            this.#liveAdmission(socket)?.generation !== admission.generation ||
            !admitsRoomMember(latest, admission) ||
            checksumCanonicalJson(latest.revisions) !==
              checksumCanonicalJson(authorization.revisions) ||
            this.#cache?.scene?.id !== sceneId ||
            this.#cache.presentation?.expectedPresentationVersion !==
              presentation.expectedPresentationVersion
          )
            throw new Error('Live Session binding admission expired before commit.')
          if (!receipt || !nextStateJson || entry.sequence !== sequence)
            throw new Error('Room binding sequence does not match its authority.')
          const committed = this.#journal.commitInTransaction({
            actorId: admission.userId,
            authorityEpoch: value.authorityEpoch,
            commandId,
            fingerprint,
            expectedSequence: current.sequence,
            expectedStateChecksum: current.stateChecksum,
            nextStateChecksum: entry.chainChecksum,
            nextStateJson,
            receiptJson: JSON.stringify(receipt)
          })
          if (committed.kind !== 'COMMITTED')
            throw new Error('Room binding unexpectedly replayed inside its transaction.')
        }
      )
      if (result.result.sceneId === sceneId)
        this.#authorization.applyPlay(value.authorityEpoch, result.play)
      this.#cache = {
        ...synchronized,
        encounterId: result.encounterId,
        visionEncounterIds: result.encounterIds,
        scene: result.composition.scene,
        characterRevisions: result.composition.characterRevisions
      }
      if (!receipt) throw new Error('Committed room binding receipt is unavailable.')
      for (const member of this.ctx.getWebSockets()) {
        const active = this.#liveAdmission(member)
        if (active && admitsRoomMember(authorization, active)) send(member, receipt)
      }
      this.#broadcastStateSync()
      await this.#scheduleAlarm()
    } catch (error) {
      this.#rejectExternal(socket, commandId, error, undefined)
    }
  }

  /** Maps a failed Scene command to its user-safe rejection. */
  #rejectExternal(
    socket: WebSocket,
    commandId: string,
    error: unknown,
    correction: LiveSessionCorrectionDto | undefined
  ): void {
    if (
      error instanceof LiveSessionDomainRejectionError ||
      error instanceof EncounterDomainRejection
    ) {
      const rejection = error instanceof EncounterDomainRejection ? error.data : error.rejection
      send(socket, {
        code: 'DOMAIN_REJECTED',
        commandId,
        ...(correction ? { correction } : {}),
        currentSequence: this.#journal.readCurrent()?.sequence ?? 0,
        message: rejection.message,
        reason: rejection.reason,
        warnings: rejection.reason === 'RULE_WARNINGS' ? rejection.warnings : null,
        type: 'COMMAND_REJECTED'
      })
      return
    }
    if (error instanceof RoomRateLimitedError) {
      this.#rejectCommand(socket, commandId, 'RATE_LIMITED', error.message)
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

  /** Whether a member's command requires geometry planning on the synchronized Scene. */
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
    this.#aggregateNeedsReload = true
    this.#bumpCacheGeneration()
    for (const socket of this.ctx.getWebSockets()) this.#challenge(socket)
  }

  /**
   * Reloads the authorization cache for the room's active epoch and closes every socket whose member
   * left, changed role or started a new membership epoch; they reconnect with a fresh admission.
   */
  async #refreshAuthorization(): Promise<LiveSessionRoomAuthorization> {
    const current = this.#journal.readCurrent()
    if (!current || current.status !== 'ACTIVE') throw new Error('Live Session authority changed.')
    const authorization = await this.#restoreLocalPlayAuthorization(
      await this.#authorization.refresh(current.authorityEpoch)
    )
    for (const socket of this.ctx.getWebSockets()) {
      const value = attachment(socket)
      const member =
        this.#admissions.get(socket) ??
        (value?.membershipEpoch ? { ...value, membershipEpoch: value.membershipEpoch } : null)
      if (member && !admitsRoomMember(authorization, member))
        this.#closeSocket(socket, 'Campaign access ended.')
    }
    this.#queuePostCommit()
    return authorization
  }

  /**
   * After every committed room transaction and each authorization reload: reconciles the departures
   * Convex leaves to the room for the Runs it holds (D74), so a Run hydrated later is corrected
   * before any checkpoint carries it, then pushes the subscribed Sheets whose play stream version
   * changed (D73). It queues behind the running command, so the command's own receipt reaches its
   * sender first. A failed step is logged and retried by the next trigger; the chain stays alive.
   */
  #queuePostCommit(): void {
    if (this.#postCommitQueued) return
    this.#postCommitQueued = true
    this.#commandChain = this.#commandChain.then(async () => {
      this.#postCommitQueued = false
      const current = this.#journal.readCurrent()
      if (!current || current.status !== 'ACTIVE') return
      try {
        await this.#reconcileActorDepartures(current)
      } catch (error) {
        console.error('Live Session actor reconcile failed.', error)
      }
      try {
        if (this.#sheetFeed.size === 0) return
        if (this.#aggregateNeedsReload) await this.#flushOutbox()
        await this.#loadRoomAggregate(this.#cache?.scene?.id ?? null)
        await this.#sheetFeed.push()
      } catch (error) {
        console.error('Live Session Sheet push failed.', error)
      }
    })
  }

  /**
   * One journaled transaction, only when an open Run names a departure. Convex reads whether an
   * unassigned Character still exists only then; a deleted one's actor is removed, which Convex
   * must ingest before the receipt, so the room checkpoints first (D74).
   */
  async #reconcileActorDepartures(
    current: NonNullable<ReturnType<DurableCommandJournal['readCurrent']>>
  ): Promise<void> {
    const authorization = this.#authorization.current(current.authorityEpoch)
    if (!authorization) return
    if (this.#aggregateNeedsReload) await this.#flushOutbox()
    const departures = await readRoomActorDepartures(this.#roomStore, authorization)
    if (!departures) return
    const campaignId = this.#roomCampaignId()
    if (!campaignId) throw new Error('Live Session Campaign is unavailable.')
    const deletedCharacterIds = departures.unassignedCharacterIds.length
      ? await this.#roomInputs.deletedCharacterIds(departures.unassignedCharacterIds)
      : new Set<string>()
    const commandId = crypto.randomUUID()
    const sequence = current.sequence + 1
    const receipt = liveSessionWebSocketServerMessageDtoSchema.parse({
      type: 'COMMAND_COMMITTED',
      commandId,
      delta: null,
      sequence
    })
    this.#roomStore.assertAuthorityHead({
      epoch: current.authorityEpoch,
      sequence: current.sequence,
      checksum: current.stateChecksum
    })
    const checkpointBeforeAcknowledgement = deletedCharacterIds.size > 0
    await this.#roomStore.transact(
      (transaction) =>
        reconcileRoomActorDepartures({
          store: this.#roomStore,
          transaction,
          inputs: this.#roomInputs,
          authorization,
          campaignId,
          epoch: current.authorityEpoch,
          deletedCharacterIds
        }),
      (entry) => {
        if (this.#authorization.current(current.authorityEpoch) !== authorization)
          throw new Error('Room actor reconcile authorization changed before commit.')
        if (entry.sequence !== sequence)
          throw new Error('Room actor reconcile sequence does not match its authority.')
        const committed = this.#journal.commitInTransaction({
          actorId: current.authorityEpoch,
          authorityEpoch: current.authorityEpoch,
          commandId,
          fingerprint: checksumCanonicalJson({
            type: 'RECONCILE_ACTOR_DEPARTURES',
            revisions: authorization.revisions,
            deletedCharacterIds: [...deletedCharacterIds].sort()
          }),
          expectedSequence: current.sequence,
          expectedStateChecksum: current.stateChecksum,
          nextStateChecksum: entry.chainChecksum,
          nextStateJson: current.stateJson,
          receiptJson: JSON.stringify(receipt),
          checkpointBeforeAcknowledgement
        })
        if (committed.kind !== 'COMMITTED')
          throw new Error('Room actor reconcile unexpectedly replayed inside its transaction.')
      }
    )
    if (checkpointBeforeAcknowledgement) {
      await this.#checkpointThrough(current.authorityEpoch, sequence)
      // A removed actor drops its token binding and controls, which a `delta: null` receipt does
      // not carry: cached play and Scene go, and members resume from the committed state.
      this.#bumpCacheGeneration()
      for (const socket of this.ctx.getWebSockets()) this.#challenge(socket)
      return
    }
    for (const recipient of this.ctx.getWebSockets()) {
      const member = this.#liveAdmission(recipient)
      if (member && admitsRoomMember(authorization, member)) send(recipient, receipt)
    }
  }

  /** The cache a command or broadcast may use: current, or reloaded first by one read. */
  async #authorizationBoundary(
    value: Pick<SocketAttachment, 'authorityEpoch'>
  ): Promise<LiveSessionRoomAuthorization> {
    return this.#authorization.current(value.authorityEpoch) ?? this.#refreshAuthorization()
  }

  async #restoreLocalPlayAuthorization(
    authorization: LiveSessionRoomAuthorization
  ): Promise<LiveSessionRoomAuthorization> {
    const head = this.#journal.readCurrent()
    if (
      !head ||
      this.#aggregateNeedsReload ||
      head.sequence === head.publishedSequence ||
      this.#roomStore.epoch !== head.authorityEpoch
    )
      return authorization
    this.#roomStore.assertAuthorityHead({
      epoch: head.authorityEpoch,
      sequence: head.sequence,
      checksum: head.stateChecksum
    })
    const campaignId = this.#roomCampaignId()
    if (!campaignId) throw new Error('Live Session Campaign is unavailable.')
    const sceneId =
      this.#cache?.scene?.id ??
      hydrateNativeLiveSessionState(head.stateJson).scene?.id ??
      authorization.play.encounter?.sceneId
    const binding = sceneId
      ? await this.#roomStore.store
          .query('encounterSceneBindings')
          .withIndex('by_sceneId', (query) => query.eq('sceneId', sceneId))
          .first()
      : null
    if (binding && binding.campaignId !== campaignId)
      throw new Error('Room Encounter Scene binding Campaign mismatch.')
    const play = await readRoomEncounterPlayAuthorization(
      { db: this.#roomStore.store },
      campaignId,
      authorization.play,
      binding ?? undefined
    )
    const nativeCharacters = new Map(
      this.#roomStore.documents('characterPlayStates').map((row) => [row.characterId, row])
    )
    const characters = authorization.characters.map((character) => {
      const local = nativeCharacters.get(character.characterId)
      if (!local) return character
      if (local.userId !== character.ownerUserId)
        throw new Error('Room Character visibility owner mismatch.')
      return { ...character, partyVisibility: readCharacterPlay(local).partyVisibility }
    })
    this.#authorization.applyCharacters(head.authorityEpoch, characters)
    if (play) this.#authorization.applyPlay(head.authorityEpoch, play)
    return { ...authorization, characters, play: play ?? authorization.play }
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

  /** Admissions and drains retry a retained checkpoint; commands use the deadline alarm. */
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

  /** An older in-flight prefix cannot satisfy a later lifecycle command's acknowledgement fence. */
  async #checkpointThrough(epoch: string, sequence: number): Promise<void> {
    if (this.#outboxFlush) await this.#outboxFlush
    let previous = -1
    for (;;) {
      const head = this.#journal.readCurrent()
      if (!head || head.authorityEpoch !== epoch)
        throw new Error('Live Session authority changed during its checkpoint.')
      if (head.publishedSequence >= sequence) return
      if (head.publishedSequence === previous)
        throw new Error('The lifecycle checkpoint made no progress.')
      previous = head.publishedSequence
      await this.#flushOutbox()
    }
  }

  async #publishPending(): Promise<void> {
    const current = this.#journal.readCurrent()
    const campaignId = this.#roomCampaignId()
    if (!current || !campaignId || current.status === 'RELEASED') return
    if (this.#roomStore.epoch !== current.authorityEpoch) {
      if (current.sequence !== current.publishedSequence)
        throw new Error('The pending checkpoint has no matching room aggregate.')
      return
    }
    if (
      current.sequence === current.publishedSequence &&
      (this.#roomStore.sequence !== current.sequence ||
        this.#roomStore.checksum !== current.stateChecksum)
    )
      return // An acknowledged Convex-first command reloads its aggregate at the next boundary.
    this.#roomStore.assertAuthorityHead({
      epoch: current.authorityEpoch,
      sequence: current.sequence,
      checksum: current.stateChecksum
    })
    const response = await this.#checkpoints.flush({
      campaignId,
      epoch: current.authorityEpoch,
      knownAuthorization: this.#authorization.current(current.authorityEpoch)?.revisions ?? null
    })
    if (response) {
      const head = this.#journal.readCurrent()
      if (head && head.sequence === head.publishedSequence)
        this.#authorization.acknowledgePlay(current.authorityEpoch)
      if (!this.#authorization.acceptCheckpoint(current.authorityEpoch, response.authorization))
        await this.#authorization.refresh(current.authorityEpoch)
      const authorization = this.#authorization.current(current.authorityEpoch)
      if (authorization) await this.#restoreLocalPlayAuthorization(authorization)
    }
    await this.#scheduleAlarm()
  }
  #broadcastStateSync(): void {
    for (const socket of this.ctx.getWebSockets()) {
      const admission = this.#liveAdmission(socket)
      if (admission) this.#sendStateSync(socket, admission)
    }
  }

  /**
   * Renders one preview sample from room memory within its message: the Scene cache, the members'
   * admissions and the authorization cache (membership, bound-token control and the Character
   * revisions behind the Scene's vision). A sample never calls or waits on Convex or storage. A
   * missing, stale or expired input starts a background refresh, and samples it cannot serve yet are
   * dropped, since previews are lossy (ADR 0035 Amendments 14 and 15).
   */
  #broadcastTransient(
    origin: WebSocket,
    originAdmission: Admission,
    envelope: SceneTransientEnvelopeDto
  ): void {
    if (this.#presentationChanging) return
    const originAttachment = attachment(origin)
    if (!originAttachment) return this.#challenge(origin)
    // Broadcasts are refused while the authorization cache is stale or past its lease.
    const authorization = this.#authorization.current(originAttachment.authorityEpoch)
    if (!authorization) return this.#refreshAuthorizationInBackground()
    if (!admitsRoomMember(authorization, originAdmission)) return
    const candidates = this.ctx.getWebSockets().flatMap((socket) => {
      const candidate = this.#liveAdmission(socket)
      if (!candidate) return (this.#challenge(socket), [])
      return admitsRoomMember(authorization, candidate) ? [{ admission: candidate, socket }] : []
    })
    const cached = this.#cache
    if (!cached) return this.#refreshPreviewScene(originAttachment, originAdmission, candidates)
    const scene = cached.scene
    if (!scene || scene.id !== envelope.sceneId || scene.version !== envelope.baselineVersion)
      return
    let boundTokenControl: LiveSessionTransientCapture['originBoundTokenControl'] | null = null
    if (envelope.kind === 'TOKEN_DRAG_PREVIEW') {
      // A changed Character's vision rebuilds the Scene before drags preview it again (D33).
      if (!roomVisionCurrent(authorization, cached.characterRevisions))
        return this.#refreshPreviewVision(originAttachment, originAdmission, candidates)
      // A player's preview on an Encounter-bound Scene needs their bound-actor control (D25).
      if (originAdmission.role === 'PLAYER' && cached.encounterId !== null) {
        const play = this.#authorization.currentPlay(originAttachment.authorityEpoch)
        boundTokenControl = play
          ? roomBoundTokenControl(play, originAdmission.userId, {
              sceneId: scene.id,
              encounterId: cached.encounterId
            })
          : null
        if (!boundTokenControl) return this.#refreshAuthorizationInBackground()
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
   * The Scene vision was built from Character revisions the authorization cache no longer holds
   * (D33). The cache reloads first; a Character that really changed rebuilds the Scene's vision.
   */
  #refreshPreviewVision(
    value: SocketAttachment,
    admission: Admission,
    candidates: readonly { admission: Admission; socket: WebSocket }[]
  ): void {
    this.#refreshPreviewInBackground('scene', async () => {
      const authorization = await this.#refreshAuthorization()
      if (!roomVisionCurrent(authorization, this.#cache?.characterRevisions ?? []))
        await this.#refreshSceneCache(value, admission, candidates)
    })
  }

  /**
   * Reloads the authorization cache off the sample's path: one read at a time, and after a failure
   * none for `previewRetryMs`.
   */
  #refreshAuthorizationInBackground(): void {
    if (this.#authorizationRefreshing || Date.now() < this.#authorizationRetryAt) return
    this.#authorizationRefreshing = true
    this.ctx.waitUntil(
      this.#refreshAuthorization()
        .then(
          () => undefined,
          () => {
            this.#authorizationRetryAt = Date.now() + ROOM_LIMITS.previewRetryMs
          }
        )
        .finally(() => {
          this.#authorizationRefreshing = false
        })
    )
  }
  #overlayDurableSceneCache(sceneId: string): void {
    const current = this.#journal.readCurrent()
    if (!current || this.#cache?.scene?.id !== sceneId) return
    const durableScene = hydrateNativeLiveSessionState(current.stateJson).scene
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
    // Synchronizing broadcasts every member's state, so the authorization cache must be current.
    await this.#authorizationBoundary(value)
    if (this.#liveAdmission(socket)?.generation !== admission.generation) return
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
    let uncomposedScene = hydrated.uncomposedScene
    let revisions = hydrated.characterRevisions
    let baseOrdinals = hydrated.baseOrdinals
    let visionEncounterIds = hydrated.visionEncounterIds
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
      uncomposedScene = hydratedRetry.uncomposedScene
      revisions = hydratedRetry.characterRevisions
      baseOrdinals = hydratedRetry.baseOrdinals
      visionEncounterIds = hydratedRetry.visionEncounterIds
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
      visionEncounterIds,
      encounterId: finalCapture.sceneEncounterId,
      key: cacheKey(finalCapture),
      scene,
      uncomposedScene,
      sceneHeader: finalCapture.sceneHeader,
      presentation: finalCapture.presentation
        ? { expectedPresentationVersion: finalCapture.presentation.version }
        : null,
      synchronized: false
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
    boundTokenControl: LiveSessionTransientCapture['originBoundTokenControl'] | null,
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
    if (envelope.kind === 'PING') {
      const { x, y } = envelope.position
      if (x < 0 || y < 0 || x > scene.map.width || y > scene.map.height) return
      if (this.#budgets.get(origin)?.take('PING') !== true) return
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
    this.#sheetFeed.drop(socket)
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
      const result = await callLiveSessionRoute(this.env, null, 'present', {
        campaignId: input.campaignId,
        actorUserId: input.operation.actorUserId,
        epoch: input.operation.epoch,
        input: input.operation.input,
        expectedSequence: current?.sequence ?? 0,
        expectedStateChecksum: current?.stateChecksum ?? null
      })
      this.#aggregateNeedsReload = true
      return result
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
    await this.#checkpointThrough(fence.authorityEpoch, fence.finalSequence)
    try {
      await callLiveSessionRoute(this.env, null, 'release', input)
    } catch (error) {
      throw drainError ?? error
    }
    this.#journal.release(fence)
    this.#buckets.clear()
    // The next admitted socket bootstraps a fresh epoch over the released journal.
    this.#activation = null
    this.ctx.storage.sql.exec('DELETE FROM room_idle_release WHERE id = 1')
    return closed
  }

  #closeSockets(
    operation:
      | { type: 'CLOSE_ROOM' }
      | { membershipEpoch: string; type: 'EVICT_USER'; userId: string },
    reason?: string
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
          reason ??
            (operation.type === 'CLOSE_ROOM'
              ? 'The Campaign live table closed.'
              : 'Campaign access ended.')
        )
      closed += 1
    }
    this.#bumpCacheGeneration()
    this.#movementIndexes.clear()
    return closed
  }

  /**
   * Cached Scene state and rules captures belong to one generation; a bump discards both, and the
   * bound Encounter's actor control reloads before previews use it.
   */
  #bumpCacheGeneration(): void {
    this.#cacheGeneration += 1
    this.#cache = null
    this.#captureCache.clear()
    this.#authorization.invalidatePlay()
  }

  #json(value: string): unknown {
    try {
      return JSON.parse(value) as unknown
    } catch {
      return null
    }
  }
}
