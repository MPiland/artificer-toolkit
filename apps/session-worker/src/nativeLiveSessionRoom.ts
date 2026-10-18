import { DurableObject } from 'cloudflare:workers'
import {
  LIVE_SESSION_CHECKPOINT_BARRIER_PATH,
  LIVE_SESSION_CONTROL_PATH,
  LIVE_SESSION_METER_PATH,
  LIVE_SESSION_TEST_ROLLS_PATH,
  liveSessionControlInputSchema,
  liveSessionTestRollsInputSchema,
  liveSessionWebSocketClientMessageDtoSchema,
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionCommandRejectionCodeDto,
  type LiveSessionCorrectionDto,
  type LiveSessionPresentationControlInput,
  type LiveSessionWebSocketClientMessageDto,
  type LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import type { LiveSessionCheckpointReason } from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import type { LiveSessionCheckpointJournalEntry } from '@artificer-toolkit/schema/api/liveSessionCheckpointJournal'
import type { LiveSessionRoomSceneCapture } from '@artificer-toolkit/schema/api/liveSessionTransient'
import type { LiveSessionRoomAuthorization } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import type { LiveSessionScenePublicationDto } from '@artificer-toolkit/schema/api/liveSessionState'
import {
  scenePresentationFenceSchema,
  type SceneBaseOrdinals
} from '@artificer-toolkit/schema/api/sceneGeometry'
import {
  sceneLiveStateHeaderSchema,
  type SceneLiveStateHeader
} from '@artificer-toolkit/schema/api/sceneLiveState'
import { DOMAIN_REJECTION_MESSAGES } from '@artificer-toolkit/schema/api/domainRejections'
import {
  LIVE_SESSION_PUSHED_CHAT_ENTRY_LIMIT,
  LIVE_SESSION_TRY_AGAIN_MESSAGE,
  type LiveSessionCommandDto
} from '@artificer-toolkit/schema/api/liveSessionCommands'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { readCharacterCommandReplay } from '@artificer-toolkit/encounter-persistence/characterSheetReceipts'
import { readSceneHoldingDecision } from '@artificer-toolkit/encounter-persistence/occurrenceOwner'
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
import { isLocalDevelopment } from './contentSnapshotStorage.js'
import {
  createNativeLiveSessionState,
  hydrateNativeLiveSessionState,
  projectNativeLiveSessionState
} from './nativeLiveSessionState.js'
import {
  canPreviewSceneTokenDrag,
  isInlineSceneCommand,
  isStagedSceneCommand,
  liveSessionSceneCommandInputSchema,
  planLiveSceneCommand
} from './nativeRoomSceneCommand.js'
import {
  callLiveSessionRoute,
  LiveSessionDomainRejectionError,
  LiveSessionRouteError
} from './liveSessionRoutes.js'
import {
  encounterCommandRefusal,
  RoomAdmissionExpiredError,
  sceneNotPresentedRejection
} from './nativeRoomEncounterCommand.js'
import { RetryableCommandError } from './nativeRulesRevisions.js'
import { retryPreparation } from './roomPreparationRetry.js'
import type { StagedSceneCommand, StagedSceneContext } from './roomSceneGeometryPlan.js'
import { createNativeLiveRulesRuntime, secureRandomInt } from './nativeRulesRuntime.js'
import { RoomEncounterStore } from './roomEncounterStore.js'
import { RoomTestDice } from './roomTestDice.js'
import { RoomInputs } from './roomInputs.js'
import { RoomCheckpoints } from './roomCheckpoints.js'
import { publishRoomCheckpoint } from './roomCheckpointPublication.js'
import { meterFrame, meterStorage, RoomMeter, sqlRoomMeterStore } from './roomMeter.js'
import { persistRoomSceneCommand } from './roomSceneCommandPersistence.js'
import { executeRoomSceneGeometry } from './roomSceneGeometryCommand.js'
import { readRoomSceneHeader, readRoomSceneState } from './roomSceneRead.js'
import { composeRoomSceneVision } from './roomSceneVision.js'
import { executeRoomSceneBinding } from './roomSceneBinding.js'
import {
  NoSceneMoveToUndoError,
  SceneMoveFromActionError,
  SceneMoveSettledMechanicsError,
  publishRoomSceneUndo
} from './roomSceneUndo.js'
import { restoreRoomMoveUndo } from './roomMoveUndoRestore.js'
import {
  publishRoomSceneFog,
  publishRoomSceneInline,
  readRoomSceneFogReceipt,
  RoomSceneCommandRefusal,
  type RoomSceneEditWork
} from './roomSceneEdits.js'
import { RoomSceneFogUploads } from './roomSceneFogUploads.js'
import { executeRoomCharacterSheetCommand } from './roomCharacterSheetCommands.js'
import { CampaignChatCommandError, executeRoomCampaignChatCommand } from './roomChatCommands.js'
import {
  RoomAccountBuckets,
  RoomRateLimitedError,
  type AccountBucketKind
} from './roomRateLimits.js'
import { endRoomBrokenRelationships, roomHasBrokenRelationships } from './roomRelationshipEnds.js'
import { readRoomActorDepartures, reconcileRoomActorDepartures } from './roomActorReconcile.js'
import { RoomCharacterSheetFeed, type FeedScope } from './roomCharacterSheetFeed.js'
import type { RoomSceneTokens } from './roomEncounterReadPorts.js'
import { RoomEncounterReads } from './roomEncounterReads.js'
import { lookupRoomEncounterReplay } from './roomEncounterReplayIndex.js'
import { RoomCampaignSummaryFeed } from './roomCampaignSummaryFeed.js'
import { RoomEncounterSessionFeed } from './roomEncounterSessionFeed.js'
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
  adoptSceneVisionRevisions,
  admitsRoomMember,
  RoomAuthorization,
  roomBoundTokenControl,
  roomVisionCurrent,
  type BoundTokenControl
} from './roomAuthorization.js'
import {
  exceedsMessageBytes,
  messageClass,
  PendingWork,
  ROOM_LIMITS,
  SocketMessageBudget
} from './roomLimits.js'
import { verifiedAccessTokenSubject } from './accessTokenSubject.js'
import { verifyLiveSessionTicket } from './ticket.js'

const INTERNAL_TICKET_HEADER = 'x-artificer-live-session-ticket'

/**
 * What survives hibernation about a socket. `admissionDeadline` (the admission's token expiry) and
 * `feeds` are set only while the socket is admitted and cleared when it is challenged or closed, so
 * a woken room restores an admission only for a socket that held one. No token is ever stored.
 */
const socketAttachmentSchema = z.strictObject({
  acceptedAt: z.number().int().positive(),
  admissionDeadline: z.nullable(z.number().int().positive()),
  authSubject: z.string().min(1),
  authorityEpoch: z.string().uuid(),
  campaignId: z.string().uuid(),
  feeds: z.nullable(
    z.strictObject({
      characterSheet: z.nullable(z.string().uuid()),
      encounterSession: z.nullable(
        z.strictObject({
          timeline: z.boolean(),
          shown: z.nullable(
            z.strictObject({
              encounterId: z.string().uuid(),
              occurrenceId: z.string().uuid(),
              occurrenceVersion: z.number().int().nonnegative()
            })
          )
        })
      ),
      campaignSummary: z.boolean()
    })
  ),
  membershipEpoch: z.nullable(z.iso.datetime({ offset: true })),
  role: z.enum(['OWNER', 'PLAYER']),
  socketId: z.string().uuid(),
  ticketExpiresAt: z.number().int().positive(),
  userId: z.string().uuid()
})
type SocketAttachment = z.infer<typeof socketAttachmentSchema>

interface Admission {
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
  characterRevisions: LiveSessionRoomSceneCapture['observedCharacterRevisions']
  encounterId: string | null
  key: string
  scene: CampaignSceneStateDto | null
  /** Authored token vision only; derived Character vision is never persisted as an override. */
  uncomposedScene: CampaignSceneStateDto | null
  sceneHeader: SceneLiveStateHeader | null
  presentation: LiveSessionScenePublicationDto['presentation'] | null
}

/** The part of the cache a woken room cannot derive from its own rows; the rest is rebuilt from them. */
const persistedSceneCacheSchema = z.strictObject({
  key: z.string(),
  sceneHeader: z.nullable(sceneLiveStateHeaderSchema),
  encounterId: z.nullable(z.string()),
  presentation: z.nullable(scenePresentationFenceSchema)
})

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
  return {
    role: value.role === 'OWNER' ? 'GM' : 'PLAYER',
    userId: value.userId
  }
}

function send(socket: WebSocket, message: LiveSessionWebSocketServerMessageDto): void {
  if (socket.readyState !== WebSocket.OPEN) return
  socket.send(JSON.stringify(liveSessionWebSocketServerMessageDtoSchema.parse(message)))
  meterFrame(socket, message.type)
}

/**
 * A stored command receipt sent again for an exact retry. Its Scene or binding result reports
 * `replayed: true`, as Convex's replays do; an Encounter result has no replay flag.
 */
function replayReceipt(receiptJson: string): LiveSessionWebSocketServerMessageDto {
  return replayMessage(liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(receiptJson)))
}

function replayMessage(
  receipt: LiveSessionWebSocketServerMessageDto
): LiveSessionWebSocketServerMessageDto {
  if (receipt.type !== 'COMMAND_COMMITTED')
    throw new Error('Live Session command receipt is invalid.')
  const { delta } = receipt
  if (delta?.scope === 'SCENE')
    return {
      ...receipt,
      delta: { ...delta, result: { ...delta.result, replayed: true } }
    }
  if (delta?.scope === 'ENCOUNTER_BINDING')
    return {
      ...receipt,
      delta: { ...delta, result: { ...delta.result, replayed: true } }
    }
  return receipt
}

function streamKey(envelope: SceneTransientEnvelopeDto): string {
  if (envelope.kind === 'TOKEN_DRAG_PREVIEW') return `${envelope.kind}:${envelope.tokenId}`
  if (envelope.kind === 'FOG_AREA_PREVIEW')
    return `${envelope.kind}:${envelope.ownerUserId ?? 'SHARED_PARTY'}`
  return envelope.kind
}

function cacheKey(capture: LiveSessionRoomSceneCapture): string {
  return JSON.stringify({
    campaignId: capture.campaignId,
    presentation: capture.presentation,
    sceneEncounterId: capture.sceneEncounterId,
    sceneHeader: capture.sceneHeader,
    systemId: capture.systemId,
    visionFreshness: capture.visionFreshness,
    observedCharacterRevisions: capture.observedCharacterRevisions
  })
}

function authorityFingerprint(capture: LiveSessionRoomSceneCapture): unknown {
  return {
    campaignId: capture.campaignId,
    presentation: capture.presentation,
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
  /** A GM's fog patches staged over the socket before their journaled publication (D79). */
  readonly #fogUploads: RoomSceneFogUploads
  /** Held Character Sheets pushed to their owner and the GM (D73). */
  readonly #sheetFeed: RoomCharacterSheetFeed
  /** The held Encounter session pushed to the sockets that subscribed to it. */
  readonly #encounterFeed: RoomEncounterSessionFeed
  /** The live Campaign summary pushed to the sockets that subscribed to it (Amendment 19). */
  readonly #summaryFeed: RoomCampaignSummaryFeed
  /** The version-keyed turn reads a member asks the room for instead of Convex. */
  readonly #encounterReads: RoomEncounterReads
  #postCommitQueued = false
  readonly #checkpoints: RoomCheckpoints
  #aggregateNeedsReload = false
  #reloadQueued = false
  /** A failed backlog save is not retried before this time. */
  #backlogRetryAt = 0
  readonly #admissions = new Map<WebSocket, Admission>()
  readonly #authenticating = new Map<
    WebSocket,
    { accessToken: string; deadline: number; generation: number }
  >()
  readonly #generations = new Map<WebSocket, number>()
  /**
   * Sockets challenged ahead of their admission's expiry, with that expiry: a socket still not
   * re-admitted then is closed with a reason instead of lingering unadmitted (Amendment 23).
   */
  readonly #expiring = new Map<WebSocket, number>()
  readonly #movementIndexes = new Map<
    string,
    { barriers: CampaignSceneStateDto['barriers']; index: SceneBarrierIndex }
  >()
  #activation: Promise<void> | null = null
  /** Set once Campaign deletion emptied the storage; this instance then answers nothing else. */
  #storageDeleted = false
  /**
   * The cold admission in flight, settled (never rejected) when it ends. A woken room re-admits its
   * surviving sockets at once; they wait for this one cold admission and then admit warm.
   */
  #coldAdmission: Promise<void> | null = null
  readonly #previewStreams = new Map<WebSocket, Map<string, PreviewStream>>()
  readonly #authorization: RoomAuthorization
  readonly #testDice = new RoomTestDice()
  /** The platform's dice; a local-development test's queued rolls come first (`roomTestDice.ts`). */
  readonly #random = (maximum: number): number =>
    (isLocalDevelopment(this.env) ? this.#testDice.next(maximum) : null) ?? secureRandomInt(maximum)
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
  #cacheValue: TransientCache | null = null
  /** The persisted part of the cache as last written, serialized; null while no row exists. */
  #savedCache: string | null = null
  #cacheGeneration = 0
  #presentationChanging = false
  readonly #meter: RoomMeter
  readonly #storage: DurableObjectStorage
  #commandChain: Promise<void> = Promise.resolve()
  #outboxFlush: Promise<void> | null = null
  #storageRecovery: Promise<void> | null = null
  #rulesRuntime: RulesRuntimeService | null = null

  constructor(ctx: DurableObjectState, env: SessionWorkerEnvironment) {
    super(ctx, env)
    // Persisted through the raw storage, so the meter never counts its own rows; development only.
    this.#meter = new RoomMeter(
      isLocalDevelopment(env) ? sqlRoomMeterStore(ctx.storage.sql) : undefined
    )
    // Sockets that survived hibernation are counted from this wake; later ones at their upgrade.
    for (const socket of ctx.getWebSockets()) this.#meter.watch(socket)
    const storage = meterStorage(ctx.storage, this.#meter)
    this.#storage = storage
    this.#journal = new DurableCommandJournal(storage)
    this.#buckets = new RoomAccountBuckets(storage.sql)
    this.#authorization = new RoomAuthorization(({ epoch, known }) => {
      const campaignId = this.#roomCampaignId()
      if (!campaignId) throw new Error('Live Session room identity is missing.')
      return callLiveSessionRoute(this.env, null, 'roomAuthorization', {
        campaignId,
        epoch,
        known
      })
    }, storage.sql)
    this.#fogUploads = new RoomSceneFogUploads(storage.sql)
    this.#roomStore = new RoomEncounterStore(
      storage,
      () => {
        this.#queuePostCommit()
        this.#saveBacklogIfFull()
      },
      (entry) => this.#journalInputReload(entry)
    )
    this.#checkpoints = new RoomCheckpoints(
      this.#roomStore,
      storage,
      async (input, reason) => {
        const started = Date.now()
        const published = await publishRoomCheckpoint(this.env, input, reason)
        this.#meter.checkpoint({
          reason,
          payloadBytes: published.payloadBytes,
          requests: published.requests,
          wallMs: Date.now() - started,
          io: published.response.io
        })
        return published.response
      },
      (ack) => {
        this.#journal.acknowledgeCheckpointInTransaction({
          authorityEpoch: ack.epoch,
          throughSequence: ack.sequence,
          stateChecksum: ack.checksum
        })
      },
      ({ campaignId, epoch, knownAuthorization: sent }, { adopted }) => {
        if (!sent) return
        this.#authorization.adopt(epoch, sent, adopted)
        this.#roomInputs.adopt(campaignId, sent, adopted)
        if (this.#cache)
          this.#cache = {
            ...this.#cache,
            characterRevisions: adoptSceneVisionRevisions(
              this.#cache.characterRevisions,
              sent,
              adopted
            )
          }
      }
    )
    this.#roomInputs = new RoomInputs(
      this.#roomStore,
      (epoch, scope) => {
        const campaignId = this.#roomCampaignId()
        if (!campaignId) throw new Error('Live Session room identity is missing.')
        return callLiveSessionRoute(this.env, null, 'roomInputs', {
          campaignId,
          epoch,
          scope
        })
      },
      (manifest) => {
        const campaignId = this.#roomCampaignId()
        if (!campaignId) throw new Error('Live Session room identity is missing.')
        return loadRoomContentSnapshots(this.env, manifest, campaignId)
      }
    )
    const feedDependencies = {
      store: this.#roomStore,
      inputs: this.#roomInputs,
      authorize: (scope: FeedScope) => this.#authorizationBoundary(scope),
      admission: (socket: WebSocket) => this.#liveAdmission(socket),
      scope: (socket: WebSocket) => {
        const value = attachment(socket)
        return value && this.#journal.readCurrent()?.authorityEpoch === value.authorityEpoch
          ? {
              authorityEpoch: value.authorityEpoch,
              campaignId: value.campaignId
            }
          : null
      },
      sceneTokens: (scope: FeedScope) => this.#sceneTokens(scope.authorityEpoch),
      send,
      remember: (socket: WebSocket) => this.#rememberFeeds(socket)
    }
    this.#sheetFeed = new RoomCharacterSheetFeed(feedDependencies)
    this.#encounterFeed = new RoomEncounterSessionFeed(feedDependencies)
    this.#summaryFeed = new RoomCampaignSummaryFeed(feedDependencies)
    this.#encounterReads = new RoomEncounterReads({
      ...feedDependencies,
      authorization: (scope) => this.#authorization.currentPlay(scope.authorityEpoch),
      presentedSceneId: () => this.#cache?.scene?.id ?? null
    })
    ctx.blockConcurrencyWhile(async () => {
      storage.sql.exec(`
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
        CREATE TABLE IF NOT EXISTS room_scene_cache (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          state TEXT NOT NULL
        );
      `)
      await this.#restoreSceneCache()
    })
    // Hibernation must be transparent: whatever is valid while awake is persisted when it changes
    // and restored here. A socket that held an admission keeps it (its attachment records the token
    // expiry, never the token) with its feed subscriptions, and the authorization lease and Scene
    // cache are restored from SQLite, so a wake costs no sign-in round. A socket that was challenged,
    // never admitted, or whose token expired asleep authenticates again.
    for (const socket of ctx.getWebSockets()) this.#wake(socket)
  }

  /** Restores one surviving socket's admission and feeds from its attachment, else challenges it. */
  #wake(socket: WebSocket): void {
    const value = attachment(socket)
    if (
      !value ||
      value.membershipEpoch === null ||
      value.admissionDeadline === null ||
      value.admissionDeadline <= Date.now()
    )
      return this.#challenge(socket)
    // A restore is not an admission event, so the meter does not count it.
    this.#generations.set(socket, 0)
    this.#admissions.set(socket, {
      deadline: value.admissionDeadline,
      generation: 0,
      membershipEpoch: value.membershipEpoch,
      role: value.role,
      userId: value.userId
    })
    this.#trackExpiry(socket, value.admissionDeadline)
    if (value.feeds?.characterSheet) this.#sheetFeed.restore(socket, value.feeds.characterSheet)
    if (value.feeds?.encounterSession)
      this.#encounterFeed.restore(socket, value.feeds.encounterSession)
    if (value.feeds?.campaignSummary) this.#summaryFeed.restore(socket)
  }

  /** A token already inside the re-authentication window is not challenged again; it runs to expiry. */
  #trackExpiry(socket: WebSocket, deadline: number): void {
    if (deadline - ROOM_LIMITS.reauthenticationLeadMs > Date.now()) this.#expiring.delete(socket)
    else this.#expiring.set(socket, deadline)
  }

  /** Writes the socket's feed subscriptions into its attachment, so a woken room restores them. */
  #rememberFeeds(socket: WebSocket): void {
    const value = socket.readyState === WebSocket.OPEN ? attachment(socket) : null
    if (!value) return
    const characterSheet = this.#sheetFeed.saved(socket)
    const encounterSession = this.#encounterFeed.saved(socket)
    const campaignSummary = this.#summaryFeed.saved(socket)
    const feeds =
      characterSheet || encounterSession || campaignSummary
        ? { characterSheet, encounterSession, campaignSummary }
        : null
    if (JSON.stringify(feeds) !== JSON.stringify(value.feeds))
      socket.serializeAttachment({ ...value, feeds })
  }

  /** An accessor so every assignment keeps the copy a woken room restores from current. */
  get #cache(): TransientCache | null {
    return this.#cacheValue
  }

  set #cache(value: TransientCache | null) {
    this.#cacheValue = value
    const saved =
      value &&
      JSON.stringify({
        key: value.key,
        sceneHeader: value.sceneHeader,
        encounterId: value.encounterId,
        presentation: value.presentation
      } satisfies z.infer<typeof persistedSceneCacheSchema>)
    if (saved === this.#savedCache) return
    if (saved === null) this.#storage.sql.exec('DELETE FROM room_scene_cache WHERE id = 1')
    else
      this.#storage.sql.exec(
        `INSERT INTO room_scene_cache (id, state) VALUES (1, ?)
         ON CONFLICT (id) DO UPDATE SET state = excluded.state`,
        saved
      )
    this.#savedCache = saved
  }

  /**
   * Rebuilds the Scene cache of a room that slept, from its own SQLite and the persisted part: the
   * Scene rows are the room's, so no member's token is needed. A failure leaves no cache, and the
   * next admission or preview rebuilds it from Convex.
   */
  async #restoreSceneCache(): Promise<void> {
    const row = this.#storage.sql
      .exec<{ state: string }>('SELECT state FROM room_scene_cache WHERE id = 1')
      .toArray()[0]
    if (!row) return
    this.#savedCache = row.state
    const current = this.#journal.readCurrent()
    const campaignId = this.#roomCampaignId()
    try {
      const saved = persistedSceneCacheSchema.parse(JSON.parse(row.state))
      if (current?.status !== 'ACTIVE' || !campaignId) {
        this.#cache = null
        return
      }
      const rebuilt = await this.#buildSceneCache(
        { authorityEpoch: current.authorityEpoch, campaignId },
        saved
      )
      this.#cache = { ...rebuilt, ...saved }
      if (saved.sceneHeader) this.#overlayDurableSceneCache(saved.sceneHeader.id)
    } catch (error) {
      console.error('Live Session Scene cache restore failed.', error)
      this.#cache = null
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    // A deleted room's tables are gone; only a repeated control request is still meaningful.
    if (this.#storageDeleted)
      return request.method === 'POST' && url.pathname === LIVE_SESSION_CONTROL_PATH
        ? Response.json({ closed: 0 })
        : new Response('The Campaign live table was deleted.', { status: 410 })
    this.#meter.request('HTTP')
    // Reachable only through the development-guarded Worker route; production never forwards it.
    if (request.method === 'GET' && url.pathname === LIVE_SESSION_METER_PATH)
      return Response.json(this.#meter.read())
    if (request.method === 'POST' && url.pathname === LIVE_SESSION_CHECKPOINT_BARRIER_PATH) {
      // Behind every accepted command, so the barrier covers all of them; development only, like the meter.
      const barrier = this.#commandChain.then(() => this.#publishThroughHead())
      this.#commandChain = barrier.then(
        () => undefined,
        () => undefined
      )
      try {
        const publishedSequence = await barrier
        return publishedSequence === null
          ? new Response('The room holds no live authority.', { status: 409 })
          : Response.json({ publishedSequence })
      } catch (error) {
        console.error('Live Session room barrier checkpoint failed.', error)
        return new Response('The room barrier checkpoint failed.', {
          status: 500
        })
      }
    }
    // Local development only, like the routes above; the Worker's own gate is checked first.
    if (request.method === 'POST' && url.pathname === LIVE_SESSION_TEST_ROLLS_PATH) {
      if (!isLocalDevelopment(this.env)) return new Response('Not found.', { status: 404 })
      const parsed = liveSessionTestRollsInputSchema.safeParse(
        await request.json().catch(() => null)
      )
      if (!parsed.success) return new Response('Invalid test rolls request.', { status: 400 })
      this.#testDice.replace(parsed.data)
      return new Response(null, { status: 204 })
    }
    if (request.method === 'POST' && url.pathname === LIVE_SESSION_CONTROL_PATH) {
      const parsed = liveSessionControlInputSchema.safeParse(await request.json().catch(() => null))
      if (!parsed.success)
        return new Response('Invalid live-session control request.', {
          status: 400
        })
      const roomCampaignId = this.#roomCampaignId()
      if (roomCampaignId && roomCampaignId !== parsed.data.campaignId)
        return new Response('Live-session room identity does not match.', {
          status: 409
        })
      if (parsed.data.operation.type === 'EVICT_USER') {
        const closed = this.#closeSockets(parsed.data.operation)
        this.#buckets.deleteUser(parsed.data.operation.userId)
        this.#fogUploads.deleteUser(parsed.data.operation.userId)
        await this.#refreshIdleRelease()
        return Response.json({ closed })
      }
      if (parsed.data.operation.type === 'INVALIDATE_INPUTS') {
        this.#authorization.invalidate()
        // With a socket connected every input reloads now (Amendment 21). With none, membership
        // still reloads now since it can end sockets, and other inputs reload before their next use.
        if (this.ctx.getWebSockets().some((socket) => this.#liveAdmission(socket)))
          this.#queueEagerReload()
        else if (parsed.data.operation.scopes.includes('CAMPAIGN'))
          this.ctx.waitUntil(this.#queueMembershipReload())
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
        } catch (error) {
          console.error('Live Scene presentation failed in the room.', error)
          return new Response('Live Scene presentation is unavailable.', {
            status: 409
          })
        }
      }
      try {
        const closed = await this.#closeRoom(parsed.data.campaignId)
        if (parsed.data.operation.type === 'DELETE_ROOM') await this.#deleteRoomStorage()
        return Response.json({ closed })
      } catch (error) {
        // The drain fence and unpublished checkpoint persist; Convex retries a transient status.
        console.error('Live Session room close failed; retrying.', error)
        return new Response('Live Session room close is unavailable.', {
          status: 503
        })
      }
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
      return new Response('Live-session room identity does not match.', {
        status: 403
      })
    if (!roomCampaignId)
      this.#storage.sql.exec(
        'INSERT INTO native_room_identity (id, campaign_id) VALUES (1, ?)',
        claims.campaignId
      )
    // Refusing (rather than replacing an older socket) cannot make a user's tabs evict each other
    // in a reconnect loop. Both checks precede ticket use, so a refused attempt consumes nothing.
    if (this.ctx.getWebSockets(claims.sub).length >= ROOM_LIMITS.maxSocketsPerUser)
      return new Response('Too many live-session connections for this user.', {
        status: 429
      })
    if (this.ctx.getWebSockets().length >= ROOM_LIMITS.maxSocketsPerRoom)
      return new Response('Live-session room is full.', { status: 503 })
    const nowSeconds = Math.floor(Date.now() / 1_000)
    this.#storage.sql.exec('DELETE FROM used_tickets WHERE expires_at <= ?', nowSeconds)
    try {
      this.#storage.sql.exec(
        'INSERT INTO used_tickets (jti, expires_at) VALUES (?, ?)',
        claims.jti,
        claims.exp
      )
    } catch {
      return new Response('Live-session ticket was already used.', {
        status: 409
      })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    const acceptedAt = Date.now()
    server.serializeAttachment({
      acceptedAt,
      admissionDeadline: null,
      authSubject: claims.authSubject,
      authorityEpoch: claims.authorityEpoch,
      campaignId: claims.campaignId,
      feeds: null,
      membershipEpoch: null,
      role: claims.role,
      socketId: crypto.randomUUID(),
      ticketExpiresAt: claims.exp,
      userId: claims.sub
    } satisfies SocketAttachment)
    this.ctx.acceptWebSocket(server, [claims.sub])
    this.#meter.watch(server)
    await this.#scheduleAlarm()
    return new Response(null, {
      headers: { 'sec-websocket-protocol': 'artificer.live-session.v1' },
      status: 101,
      webSocket: client
    })
  }

  async webSocketMessage(socket: WebSocket, rawMessage: string | ArrayBuffer): Promise<void> {
    this.#meter.request('WEBSOCKET_MESSAGE')
    this.#meter.watch(socket)
    if (typeof rawMessage !== 'string' || exceedsMessageBytes(rawMessage)) {
      this.#closeSocket(socket, 'Invalid live-session message.')
      return
    }
    const parsed = liveSessionWebSocketClientMessageDtoSchema.safeParse(this.#json(rawMessage))
    this.#meter.message(parsed.success ? parsed.data.type : 'INVALID')
    let budget = this.#budgets.get(socket)
    if (!budget) {
      budget = new SocketMessageBudget()
      this.#budgets.set(socket, budget)
    }
    const kind = messageClass(parsed.success ? parsed.data : null)
    if (!budget.take(kind)) {
      this.#closeSocket(socket, `Too many live-session ${kind} messages.`)
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
    this.#renewAuthorizationIfDue()
    if (parsed.data.type === 'RESUME') {
      const value = attachment(socket)
      if (!value) return this.#challenge(socket)
      await this.#ensureSceneCache(value)
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
    if (parsed.data.type === 'UNSUBSCRIBE_ENCOUNTER_SESSION') {
      this.#encounterFeed.drop(socket)
      return
    }
    if (parsed.data.type === 'SUBSCRIBE_ENCOUNTER_SESSION') {
      this.#encounterFeed.subscribe(socket, parsed.data.timeline)
      this.#queuePostCommit()
      return
    }
    if (parsed.data.type === 'UNSUBSCRIBE_CAMPAIGN_SUMMARY') {
      this.#summaryFeed.drop(socket)
      return
    }
    if (parsed.data.type === 'SUBSCRIBE_CAMPAIGN_SUMMARY') {
      this.#summaryFeed.subscribe(socket)
      this.#queuePostCommit()
      return
    }
    if (parsed.data.type === 'ENCOUNTER_READ') {
      // Behind the running command, so the read sees one committed version.
      const message = parsed.data
      const next = this.#commandChain.then(() => this.#encounterReads.answer(socket, message))
      this.#commandChain = next
      await next
      return
    }
    if (parsed.data.type === 'COMMAND') {
      const work = { admission, message: parsed.data }
      const commandId = work.message.command.command.commandId
      // A player may have one Encounter or staged Scene command in flight; the GM's are bounded
      // per socket only.
      const playerEncounter =
        admission.role === 'PLAYER' &&
        (work.message.command.scope === 'ENCOUNTER' ||
          work.message.command.scope === 'CHARACTER_SHEET' ||
          this.#isStagedCommand(work.message.command.command))
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
        .then(() =>
          this.#meter.command(() => this.#executeCommand(socket, work.admission, work.message))
        )
        .catch((error: unknown) => {
          if (error instanceof RoomRateLimitedError)
            this.#rejectCommand(socket, commandId, 'RATE_LIMITED', error.message)
          else if (error instanceof RetryableCommandError) {
            const refusal = encounterCommandRefusal(error)
            this.#rejectCommand(socket, commandId, refusal.code, refusal.message)
          } else
            this.#rejectRoomFailure(socket, commandId, error, 'Live Session command unavailable.')
        })
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
    if (parsed.data.type === 'SCENE_FOG_BEGIN' || parsed.data.type === 'SCENE_FOG_APPEND') {
      const message = parsed.data
      const commandId =
        message.type === 'SCENE_FOG_BEGIN' ? message.input.commandId : message.commandId
      const next = this.#commandChain
        .then(() => this.#stageSceneFog(socket, admission, message))
        .catch((error: unknown) => this.#rejectRoomFailure(socket, commandId, error))
      this.#commandChain = next
      await next
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
    this.#meter.request('ALARM')
    this.#reauthenticateExpiringAdmissions()
    if (await this.#recoverStorageIfNeeded()) {
      await this.#scheduleAlarm()
      return
    }
    const now = Date.now()
    for (const socket of this.#openSockets()) {
      const value = attachment(socket)
      if (!value || value.membershipEpoch !== null || this.#admissions.has(socket)) continue
      if (value.acceptedAt + ROOM_LIMITS.authenticationTimeoutMs <= now)
        this.#closeSocket(socket, 'Live-session authentication timed out.')
    }
    this.#fogUploads.expire(now)
    this.#renewAuthorizationIfDue()
    try {
      const releaseAt = this.#idleReleaseAt()
      const campaignId = this.#roomCampaignId()
      // A socket still inside its admission window may be a reconnect, so release waits for it.
      if (releaseAt !== null && releaseAt <= now && campaignId && this.#openSockets().length === 0)
        await this.#closeRoom(campaignId)
    } catch (error) {
      // The unpublished checkpoint and drain fence persist, so a later alarm resumes the release. A
      // past deadline would spin, so the retry is bounded.
      console.error('Live Session alarm failed; retrying.', error)
      await this.ctx.storage.setAlarm(Date.now() + ROOM_LIMITS.alarmRetryMs)
      return
    }
    await this.#refreshIdleRelease()
  }

  /**
   * Challenges each admitted socket at its admission's expiry minus `reauthenticationLeadMs`, so the
   * client answers with a refreshed token. A socket not re-admitted by that expiry is closed with a
   * reason: a revoked session cannot obtain a token, so silence ends the socket here.
   */
  #reauthenticateExpiringAdmissions(): void {
    const now = Date.now()
    for (const socket of this.#openSockets()) {
      const expiresAt = this.#expiring.get(socket)
      if (expiresAt !== undefined) {
        if (expiresAt <= now) this.#closeSocket(socket, 'Live-session sign-in expired.')
        continue
      }
      const admission = this.#admissions.get(socket)
      if (!admission) continue
      if (admission.deadline <= now) this.#closeSocket(socket, 'Live-session sign-in expired.')
      else if (admission.deadline - ROOM_LIMITS.reauthenticationLeadMs <= now) {
        this.#challenge(socket, admission.generation)
        this.#expiring.set(socket, admission.deadline)
      }
    }
  }

  /**
   * Starts the idle-release window when the last admitted socket leaves an active room; an admitted
   * socket cancels it. `leaving` is a socket the runtime may still list while it closes.
   */
  async #refreshIdleRelease(leaving?: WebSocket): Promise<void> {
    // The sockets Campaign deletion closed still deliver their close events over the emptied storage.
    if (this.#storageDeleted) return
    if (this.#openSockets(leaving).some((socket) => attachment(socket)?.membershipEpoch))
      this.#storage.sql.exec('DELETE FROM room_idle_release WHERE id = 1')
    else if (this.#journal.readCurrent()?.status === 'ACTIVE')
      this.#storage.sql.exec(
        'INSERT OR IGNORE INTO room_idle_release (id, release_at) VALUES (1, ?)',
        Date.now() + ROOM_LIMITS.idleReleaseMs
      )
    await this.#scheduleAlarm(leaving)
  }

  /** The room's one alarm serves every pending admission window, the idle release and fog staging expiry. */
  async #scheduleAlarm(leaving?: WebSocket): Promise<void> {
    const open = this.#openSockets(leaving)
    const deadlines = open.flatMap((socket) => {
      const value = attachment(socket)
      const admission = this.#admissions.get(socket)
      const expiresAt = this.#expiring.get(socket)
      if (expiresAt !== undefined) return [expiresAt]
      if (admission) return [admission.deadline - ROOM_LIMITS.reauthenticationLeadMs]
      return value && value.membershipEpoch === null
        ? [value.acceptedAt + ROOM_LIMITS.authenticationTimeoutMs]
        : []
    })
    const releaseAt = this.#idleReleaseAt()
    if (releaseAt !== null && open.length === 0) deadlines.push(releaseAt)
    const fogExpiresAt = this.#fogUploads.nextExpiry()
    if (fogExpiresAt !== null) deadlines.push(fogExpiresAt)
    if (deadlines.length === 0) await this.ctx.storage.deleteAlarm()
    else await this.ctx.storage.setAlarm(Math.min(...deadlines))
  }

  #idleReleaseAt(): number | null {
    return (
      this.#storage.sql
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
    let cacheGeneration = this.#cacheGeneration
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
    let endColdAdmission: (() => void) | null = null
    try {
      // Warm admission (Amendment 18): an already-admitted socket's fresh token is proven locally
      // against the Convex site keys and its membership comes from the room's current lease, so it
      // costs no flush, capture or authorization read. Anything unproven takes the cold path below.
      if (value.membershipEpoch !== null) {
        const subject = await verifiedAccessTokenSubject(
          accessToken,
          this.env.CONVEX_SITE_URL,
          new Date(Date.now())
        )
        if (generation !== this.#generations.get(socket)) return
        if (subject !== null && subject !== value.authSubject) {
          this.#closeIfCurrent(socket, generation, 'Live-session identity changed.')
          return
        }
        if (
          subject !== null &&
          this.#coldAdmission &&
          !this.#authorization.current(value.authorityEpoch)
        ) {
          await this.#coldAdmission
          if (generation !== this.#generations.get(socket)) return
          cacheGeneration = this.#cacheGeneration
        }
        const authorization =
          subject === null ? null : this.#authorization.current(value.authorityEpoch)
        if (
          authorization &&
          admitsRoomMember(authorization, {
            membershipEpoch: value.membershipEpoch,
            role: value.role,
            userId: value.userId
          })
        ) {
          await this.#ensureSceneCache(value)
          if (
            !this.#cache ||
            this.#presentationChanging ||
            cacheGeneration !== this.#cacheGeneration
          )
            this.#challenge(socket, generation)
          else
            await this.#admit(socket, value, {
              deadline,
              generation,
              membershipEpoch: value.membershipEpoch,
              role: value.role,
              userId: value.userId
            })
          return
        }
      }
      if (!this.#coldAdmission) {
        let settle!: () => void
        const cold = new Promise<void>((resolve) => (settle = resolve))
        this.#coldAdmission = cold
        endColdAdmission = () => {
          if (this.#coldAdmission === cold) this.#coldAdmission = null
          settle()
        }
      }
      if (await this.#recoverStorageIfNeeded(value.authorityEpoch)) return
      this.#meter.epoch(value.authorityEpoch)
      // Reconnect reads the acknowledged product state after the room's pending prefix is saved.
      await this.#flushOutbox('ADMISSION')
      const capture = await callLiveSessionRoute(this.env, accessToken, 'capture', {
        campaignId: value.campaignId,
        expectedRole: value.role,
        expectedUserId: value.userId
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
            presentation: {
              expectedPresentationVersion: capture.presentation.version
            }
          }
      }
      await this.#ensureSceneCache(value)
      if (!this.#cache || this.#presentationChanging || cacheGeneration !== this.#cacheGeneration) {
        this.#challenge(socket, generation)
        return
      }
      if (
        await this.#admit(socket, value, {
          deadline,
          generation,
          membershipEpoch: capture.origin.membershipEpoch,
          role: capture.origin.role,
          userId: capture.origin.userId
        })
      )
        this.#publishInBackground()
    } catch (error) {
      if (
        error instanceof LiveSessionRouteError &&
        (error.status === 401 || error.status === 409)
      ) {
        this.#closeIfCurrent(socket, generation, 'Live-session membership changed.')
        return
      }
      // A challenge makes the client authenticate again at once, so a failure that does not change
      // between attempts would loop. Closing hands the retry to the client's backoff instead. The
      // close reason names no cause, so the cause is logged.
      console.error('Live Session activation failed.', error)
      this.#closeIfCurrent(socket, generation, 'Live-session activation failed.')
    } finally {
      endColdAdmission?.()
      if (this.#authenticating.get(socket)?.generation === generation)
        this.#authenticating.delete(socket)
    }
  }

  /** Admits the socket unless its token, ticket, generation or membership went stale; true once announced. */
  async #admit(socket: WebSocket, value: SocketAttachment, admitted: Admission): Promise<boolean> {
    const { generation } = admitted
    if (
      Date.now() >= admitted.deadline ||
      generation !== this.#generations.get(socket) ||
      (value.membershipEpoch === null && Date.now() >= value.ticketExpiresAt * 1_000)
    ) {
      if (value.membershipEpoch === null && Date.now() >= value.ticketExpiresAt * 1_000)
        this.#closeIfCurrent(socket, generation, 'Live-session ticket expired.')
      else this.#challenge(socket, generation)
      return false
    }
    const latest = attachment(socket)
    if (
      !latest ||
      (latest.membershipEpoch !== null && latest.membershipEpoch !== admitted.membershipEpoch)
    ) {
      this.#challenge(socket, generation)
      return false
    }
    if (socket.readyState !== WebSocket.OPEN || this.#generations.get(socket) !== generation)
      return false
    socket.serializeAttachment({
      ...latest,
      admissionDeadline: admitted.deadline,
      membershipEpoch: admitted.membershipEpoch
    })
    this.#admissions.set(socket, admitted)
    this.#trackExpiry(socket, admitted.deadline)
    this.#meter.admitted(
      admitted.userId,
      [...this.#admissions].filter(
        ([open, member]) => member.userId === admitted.userId && open.readyState === WebSocket.OPEN
      ).length
    )
    const current = this.#liveAdmission(socket)
    if (
      current?.generation !== admitted.generation ||
      current.role !== admitted.role ||
      current.membershipEpoch !== admitted.membershipEpoch
    )
      return false
    send(socket, { campaignId: value.campaignId, type: 'TRANSIENT_READY' })
    this.#sendStateSync(socket, current)
    this.#queuePostCommit()
    // A reconnect inside the idle window cancels the pending release.
    await this.#refreshIdleRelease()
    return true
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
          await this.#flushOutbox('ACTIVATION')
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
        await this.#flushOutbox('ACTIVATION')
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
    // The room store runs one operation at a time: a hydrate racing a command would rewind the store
    // behind the journal, so admissions load behind the running commands.
    const load = this.#commandChain.then(() => this.#loadRoomAggregate(sceneId))
    this.#commandChain = load.then(
      () => undefined,
      () => undefined
    )
    await load
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
        checkpoint: {
          epoch: replacement.epoch,
          sequence: 0,
          checksum: initial.stateChecksum
        },
        commitDurable: () => {
          this.#journal.discardFencedAuthorityInTransaction(epoch)
          this.#checkpoints.discardFencedCheckpointInTransaction()
          this.#storage.sql.exec('DELETE FROM room_idle_release')
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

  /**
   * Flushes the outbox, then reloads the held aggregate and rebuilds the Scene cache from what
   * Convex now holds. A command whose stale path found `#aggregateNeedsReload` and an eager reload
   * share it.
   */
  async #reloadRoomAggregate(value: SocketAttachment): Promise<void> {
    await this.#flushOutbox('RELOAD')
    await this.#refreshSceneCache(value)
    await this.#loadRoomAggregate(this.#cache?.scene?.id ?? null)
  }

  /**
   * A Campaign notice with no socket connected still reloads membership at once, since it can end
   * sockets and name departures. The reload and its reconcile run on the command chain, so a
   * checkpoint barrier, command or read that follows the notice orders behind them.
   */
  #queueMembershipReload(): Promise<void> {
    const reload = this.#commandChain.then(async () => {
      try {
        await this.#refreshAuthorization()
        await this.#reconcileCurrentActorDepartures()
      } catch (error) {
        console.error('Live Session membership reload failed.', error)
      }
    })
    this.#commandChain = reload
    return reload
  }

  /**
   * Reconciles departures inside the running chain task, so a later barrier, command or read
   * orders behind it; `#queuePostCommit` alone would append after them (D74).
   */
  async #reconcileCurrentActorDepartures(): Promise<void> {
    const current = this.#journal.readCurrent()
    if (current?.status === 'ACTIVE') await this.#reconcileActorDepartures(current)
  }

  /**
   * An `INVALIDATE_INPUTS` notice with a socket connected reloads at once, as a command's stale
   * path would, so a Feature or Builder edit reaches the table without waiting for a command
   * (ADR 0035 Amendment 21). Notices that arrive before the reload runs share it. A failed reload
   * leaves the cache stale for the next command's own reload and never closes a socket.
   */
  #queueEagerReload(): void {
    if (this.#reloadQueued) return
    this.#reloadQueued = true
    this.#commandChain = this.#commandChain.then(async () => {
      this.#reloadQueued = false
      const current = this.#journal.readCurrent()
      if (!current || current.status !== 'ACTIVE') return
      const origin = this.ctx.getWebSockets().find((socket) => this.#liveAdmission(socket))
      const value = origin ? attachment(origin) : null
      if (!value) return
      try {
        const authorization = await this.#refreshAuthorization()
        if (this.#aggregateNeedsReload) await this.#reloadRoomAggregate(value)
        else if (this.#cache && !roomVisionCurrent(authorization, this.#cache.characterRevisions)) {
          await this.#refreshSceneCache(value)
          this.#broadcastStateSync()
        }
        await this.#reconcileCurrentActorDepartures()
      } catch (error) {
        console.error('Live Session eager reload failed.', error)
      }
      this.#queuePostCommit()
    })
  }

  /**
   * A read that reloads stale Convex inputs writes the store outside any command. It is journaled
   * like a command with no receipt, so the store and journal heads stay equal and the room's
   * unpublished commands remain publishable. A store already behind a Convex-first command is left
   * for its next boundary reload.
   */
  #journalInputReload(entry: LiveSessionCheckpointJournalEntry): undefined {
    const current = this.#journal.readCurrent()
    if (
      !current ||
      current.status !== 'ACTIVE' ||
      this.#roomStore.epoch !== current.authorityEpoch ||
      this.#roomStore.sequence !== current.sequence ||
      this.#roomStore.checksum !== current.stateChecksum
    )
      return undefined
    const commandId = crypto.randomUUID()
    const committed = this.#journal.commitInTransaction({
      actorId: current.authorityEpoch,
      authorityEpoch: current.authorityEpoch,
      commandId,
      fingerprint: checksumCanonicalJson({
        type: 'RELOAD_ROOM_INPUTS',
        writeSetChecksum: entry.writeSetChecksum
      }),
      expectedSequence: current.sequence,
      expectedStateChecksum: current.stateChecksum,
      nextStateChecksum: entry.chainChecksum,
      nextStateJson: current.stateJson,
      receiptJson: JSON.stringify(
        liveSessionWebSocketServerMessageDtoSchema.parse({
          type: 'COMMAND_COMMITTED',
          commandId,
          delta: null,
          sequence: entry.sequence
        })
      )
    })
    if (committed.kind !== 'COMMITTED')
      throw new Error('Room input reload unexpectedly replayed inside its transaction.')
    return undefined
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
      this.#roomStore.record('ROOM_INPUT', 'AUTHORITY') &&
      (sceneId === null || this.#roomStore.record('SCENE_CHECKPOINT_SOURCE', sceneId))
    )
      return
    if (current.sequence !== current.publishedSequence) {
      this.#roomStore.assertAuthorityHead({
        epoch: current.authorityEpoch,
        sequence: current.sequence,
        checksum: current.stateChecksum
      })
      // Hydration reads Convex, so the room's unpublished commands are checkpointed first.
      await this.#checkpointThrough(current.authorityEpoch, current.sequence, 'RELOAD')
      return this.#loadRoomAggregate(sceneId)
    }
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

  /**
   * Whether `admission` controls each token bound to the cached Encounter (ADR 0034). Without current
   * play authorization on a bound Scene every token reads as uncontrolled, so no senses are shared.
   */
  #boundTokenControl(
    scene: CampaignSceneStateDto,
    admission: Pick<Admission, 'role' | 'userId'>,
    authorityEpoch: string
  ): ReadonlyMap<string, boolean> {
    const encounterId = this.#cache?.encounterId ?? null
    if (admission.role === 'OWNER' || encounterId === null) return new Map()
    const play = this.#authorization.currentPlay(authorityEpoch)
    const control =
      (play && roomBoundTokenControl(play, admission.userId, { sceneId: scene.id, encounterId })) ??
      scene.tokens.map(({ id }) => ({ tokenId: id, controlled: false }))
    return new Map(control.map(({ tokenId, controlled }) => [tokenId, controlled]))
  }

  /**
   * The tokens the presented Scene draws for a member, by the same projection as their map, so the
   * Encounter list and the map cannot disagree on who is seen (ATTACK-17.3). Null while the room holds
   * no Scene.
   */
  #sceneTokens(authorityEpoch: string): RoomSceneTokens {
    return async (member) => {
      const scene = this.#cache?.scene
      if (!scene) return null
      return {
        sceneId: scene.id,
        visibleTokenIds: new Set(
          projectSceneForViewer(
            scene,
            viewer(member),
            this.#boundTokenControl(scene, member, authorityEpoch)
          ).tokens.map(({ id }) => id)
        )
      }
    }
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
        { scene: this.#cache?.scene ?? null },
        admission,
        this.#cache?.presentation?.expectedPresentationVersion ?? null,
        this.#cache?.scene
          ? this.#boundTokenControl(this.#cache.scene, admission, value.authorityEpoch)
          : new Map()
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
    } catch (error) {
      this.#rejectRoomFailure(socket, commandId, error)
      return
    }
    if (this.#liveAdmission(socket)?.generation !== admission.generation) return
    if (!admitsRoomMember(authorization, admission))
      return this.#closeSocket(socket, 'Campaign access ended.')
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
    // A whole fog layer exceeds the socket frame; fog is staged with SCENE_FOG_BEGIN/APPEND (D79).
    if (!sceneCommand?.success) {
      this.#rejectCommand(
        socket,
        commandId,
        'INVALID_COMMAND',
        'This Scene command is not accepted live; fog changes are uploaded in batches.',
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
        await this.#reloadRoomAggregate(value)
      } catch (error) {
        this.#rejectRoomFailure(socket, commandId, error)
        return
      }
    }
    const cached = this.#cache
    const scene = cached?.scene ?? null
    const correction = (): LiveSessionCorrectionDto | undefined =>
      scene
        ? {
            scope: 'SCENE',
            state: projectSceneForViewer(
              scene,
              viewer(admission),
              this.#boundTokenControl(scene, admission, value.authorityEpoch)
            )
          }
        : undefined
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
    // Moves, door changes and undo plan against the exact Scene; edits rebase over unrelated newer
    // changes and are refused only when their own target changed.
    const exactVersion =
      command.type === 'MOVE_SCENE_TOKEN' ||
      command.type === 'SET_SCENE_DOOR_STATE' ||
      command.type === 'UNDO_LAST_SCENE_MOVE'
    if (
      !scene ||
      scene.id !== command.sceneId ||
      (exactVersion
        ? scene.version !== command.expectedSceneVersion
        : command.expectedSceneVersion > scene.version)
    ) {
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
    if (!cached?.presentation) {
      this.#rejectCommand(
        socket,
        commandId,
        'UNAVAILABLE',
        'The presented Scene is not available yet; try again.',
        current.sequence,
        correction()
      )
      return
    }
    if (
      admission.role !== 'OWNER' &&
      (command.type === 'PUBLISH_SCENE_FOG_PATCH' ||
        command.type === 'UPSERT_SCENE_TOKEN' ||
        command.type === 'REMOVE_SCENE_TOKEN' ||
        command.type === 'UPSERT_SCENE_BARRIER' ||
        command.type === 'REMOVE_SCENE_BARRIER')
    ) {
      this.#rejectCommand(socket, commandId, 'FORBIDDEN', 'Only the GM can change this Scene.')
      return
    }
    if (isInlineSceneCommand(command)) {
      try {
        await this.#commitRoomSceneEdit(socket, admission, value, command, fingerprint, (base) =>
          publishRoomSceneInline({ ...base, actor: admission, command })
        )
      } catch (error) {
        this.#rejectSceneCommand(socket, commandId, error, correction())
      }
      return
    }
    if (command.type === 'PUBLISH_SCENE_FOG_PATCH') {
      const uploader = {
        epoch: value.authorityEpoch,
        userId: admission.userId
      }
      try {
        await this.#commitRoomSceneEdit(
          socket,
          admission,
          value,
          command,
          fingerprint,
          (base) =>
            publishRoomSceneFog({
              ...base,
              actorUserId: admission.userId,
              command,
              readUpload: () => this.#fogUploads.read(uploader, command.saveId, command.commandId)
            }),
          () => this.#fogUploads.markPublished(command.saveId.toLowerCase())
        )
      } catch (error) {
        this.#rejectSceneCommand(socket, commandId, error, correction())
      }
      return
    }
    // A pending movement or reaction decision holds token moves, undo, door changes and token or
    // barrier edits on its Scene (D26).
    const holdingDecision =
      cached.encounterId === null
        ? null
        : await readSceneHoldingDecision({ db: this.#roomStore.store }, cached.encounterId)
    if (holdingDecision) {
      this.#rejectCommand(
        socket,
        commandId,
        'UNAVAILABLE',
        holdingDecision === 'MOVEMENT'
          ? 'Waiting on a movement decision.'
          : 'Waiting on a reaction decision.',
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
        await this.#commitRoomSceneEdit(
          socket,
          admission,
          value,
          command,
          fingerprint,
          ({ transaction, authorization, scene, presentation }) =>
            publishRoomSceneUndo({
              transaction,
              userId: admission.userId,
              scene,
              request: { input: command, presentation },
              onUndone: (undoneCommandId) =>
                restoreRoomMoveUndo({
                  store: this.#roomStore,
                  transaction,
                  inputs: this.#roomInputs,
                  authorization,
                  campaignId: value.campaignId,
                  epoch: value.authorityEpoch,
                  userId: admission.userId,
                  sceneId: command.sceneId.toLowerCase(),
                  undoneCommandId
                }),
              settledEncounterMechanics: async (moveCommandId) =>
                (await this.#roomStore.store
                  .query('encounterRuleReceipts')
                  .withIndex('by_campaignId_commandId', (q) =>
                    q.eq('campaignId', value.campaignId).eq('commandId', moveCommandId)
                  )
                  .first()) !== null
            })
        )
      } catch (error) {
        if (
          error instanceof NoSceneMoveToUndoError ||
          error instanceof SceneMoveFromActionError ||
          error instanceof SceneMoveSettledMechanicsError
        )
          this.#rejectCommand(socket, commandId, 'INVALID_COMMAND', error.message)
        else this.#rejectSceneCommand(socket, commandId, error, correction())
      }
      return
    }
    if (command.type !== 'MOVE_SCENE_TOKEN' && command.type !== 'SET_SCENE_DOOR_STATE') {
      try {
        await this.#commitRoomGeometry(socket, admission, value, command, fingerprint)
      } catch (error) {
        this.#rejectSceneCommand(socket, commandId, error, correction())
      }
      return
    }
    const plan = planLiveSceneCommand({
      actor: admission,
      command,
      encounterId: cached.encounterId,
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
    if (plan.kind === 'STAGED') {
      try {
        await this.#commitRoomGeometry(socket, admission, value, command, fingerprint)
      } catch (error) {
        this.#rejectSceneCommand(socket, commandId, error, correction())
      }
      return
    }
    const { delta } = plan

    let nextScene: CampaignSceneStateDto
    let nextUncomposedScene: CampaignSceneStateDto
    try {
      nextScene = applySceneDelta(scene, delta, scene.version + 1)
      if (!cached.uncomposedScene || !cached.sceneHeader)
        throw new Error('Native Scene persistence inputs are unavailable.')
      nextUncomposedScene = applySceneDelta(cached.uncomposedScene, delta, scene.version + 1)
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
    const committed = liveSessionWebSocketServerMessageDtoSchema.parse(
      this.#sceneCommittedFor({
        admission,
        epoch: value.authorityEpoch,
        committed: { commandId, sequence: current.sequence + 1 },
        before: scene,
        after: nextScene,
        result: expectedSceneResult,
        occurrence: null
      })
    )
    this.#roomStore.assertAuthorityHead({
      epoch: current.authorityEpoch,
      sequence: current.sequence,
      checksum: current.stateChecksum
    })
    const saveId = crypto.randomUUID()
    const header = cached.sceneHeader!
    const rawScene = cached.uncomposedScene!
    const state = await this.#roomStore.transact(
      (transaction) =>
        Promise.resolve(
          persistRoomSceneCommand({
            transaction,
            header,
            scene: rawScene,
            baseOrdinals: cached.baseOrdinals,
            command,
            actorUserId: admission.userId,
            result: expectedSceneResult,
            presentationVersion: cached.presentation!.expectedPresentationVersion,
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
          throw new RoomAdmissionExpiredError()
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
      ...cached,
      scene: nextScene,
      uncomposedScene: nextUncomposedScene,
      sceneHeader: {
        ...header,
        version: state.version,
        currentCounts: state.counts,
        fogLayerCount: state.fogLayerCount
      }
    }
    this.#broadcastSceneCommitted(
      { commandId, sequence: current.sequence + 1 },
      scene,
      nextScene,
      expectedSceneResult,
      { socket, message: committed }
    )
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
        if (this.#aggregateNeedsReload) await this.#flushOutbox('RELOAD')
        await this.#loadRoomAggregate(this.#cache?.scene?.id ?? null)
        movementResponse =
          (await readRoomEncounterResponseRoute(this.#roomStore, command)) === 'MOVEMENT' &&
          (command.type === 'RESOLVE_RULE_OCCURRENCE' ||
            !(await roomOwnsEncounterVoid(this.#roomStore, command)))
      } catch (error) {
        this.#rejectRoomFailure(socket, command.commandId, error)
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
      const stored: unknown = JSON.parse(prior.receipt.receiptJson)
      // A movement decision stores the Scene receipt its sender was sent, then the Encounter result.
      const messages = (Array.isArray(stored) ? stored : [stored]).map((message) =>
        liveSessionWebSocketServerMessageDtoSchema.parse(message)
      )
      const replay = messages.at(-1)
      // A commit recovered after a restart kept only its Scene receipt.
      if (replay?.type === 'COMMAND_COMMITTED' && replay.delta?.scope === 'ENCOUNTER') {
        try {
          if (
            prior.receipt.checkpointBeforeAcknowledgement &&
            prior.receipt.sequence > (this.#journal.readCurrent()?.publishedSequence ?? 0)
          )
            await this.#checkpointThrough(
              value.authorityEpoch,
              prior.receipt.sequence,
              'ACKNOWLEDGEMENT'
            )
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
            sceneTokens: this.#sceneTokens(value.authorityEpoch),
            replayed: { kind: 'RECORDED', result: replay.delta.result }
          })
          for (const sceneReceipt of messages.slice(0, -1))
            send(socket, replayMessage(sceneReceipt))
          send(socket, {
            ...replay,
            sequence:
              result.projection.version === replay.delta.result.projection.version
                ? replay.sequence
                : (this.#journal.readCurrent()?.sequence ?? replay.sequence),
            delta: { scope: 'ENCOUNTER', result }
          })
        } catch (error) {
          this.#rejectRoomFailure(socket, command.commandId, error)
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
    // A command the room's history no longer holds is still recognized from the Run's replay index.
    try {
      if (this.#aggregateNeedsReload) await this.#flushOutbox('RELOAD')
      await this.#loadRoomAggregate(this.#cache?.scene?.id ?? null)
      const indexed = await lookupRoomEncounterReplay(this.#roomStore, {
        campaignId: value.campaignId,
        commandId: command.commandId,
        encounterId: command.encounterId,
        userId: admission.userId,
        fingerprint
      })
      if (indexed.kind === 'MISMATCH') {
        this.#rejectCommand(
          socket,
          command.commandId,
          'INVALID_COMMAND',
          'The command ID was already used for different input.'
        )
        return
      }
      if (indexed.kind === 'INDEXED') {
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
          sceneTokens: this.#sceneTokens(value.authorityEpoch),
          replayed: indexed
        })
        send(socket, {
          commandId: command.commandId,
          delta: { scope: 'ENCOUNTER', result },
          sequence: this.#journal.readCurrent()?.sequence ?? 0,
          type: 'COMMAND_COMMITTED'
        })
        return
      }
    } catch (error) {
      this.#rejectRoomFailure(socket, command.commandId, error)
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
          fingerprint
        )
        if (this.#liveAdmission(socket)?.generation === admission.generation)
          send(socket, {
            commandId: command.commandId,
            delta: { scope: 'ENCOUNTER', result },
            sequence: this.#journal.readCurrent()?.sequence ?? 0,
            type: 'COMMAND_COMMITTED'
          })
      } catch (error) {
        this.#rejectSceneCommand(socket, command.commandId, error, undefined)
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
      if (this.#aggregateNeedsReload) await this.#flushOutbox('RELOAD')
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
        if (state.status !== 'ACTIVE' || state.campaignId !== value.campaignId)
          throw new CharacterSheetCommandError('Character is not held by this active Encounter.')
        const held = (await readRunActors({ db: this.#roomStore.store }, state)).some(
          (actor) =>
            actor.kind === 'CHARACTER' &&
            actor.sourceId === character.characterId &&
            actor.frozenState === null
        )
        if (!held) {
          // A caster outside the Run holds no play here: the stored acknowledgement is the replay.
          if (command.command.type !== 'END_CONCENTRATION')
            throw new CharacterSheetCommandError('Character is not held by this active Encounter.')
          send(socket, receipt)
          return
        }
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
      const { result, authorization: committedAuthorization } = await this.#prepareWithRetry(
        authorization,
        (prepared, random) =>
          this.#roomStore.transact(
            async (transaction) => {
              const executed = await executeRoomCharacterSheetCommand({
                store: this.#roomStore,
                transaction,
                inputs: this.#roomInputs,
                authorization: prepared,
                campaignId: value.campaignId,
                epoch: value.authorityEpoch,
                userId: admission.userId,
                command,
                random
              })
              const composition = sceneCache?.uncomposedScene
                ? await composeRoomSceneVision({
                    store: this.#roomStore,
                    transaction,
                    inputs: this.#roomInputs,
                    authorization: prepared,
                    campaignId: value.campaignId,
                    epoch: value.authorityEpoch,
                    scene: sceneCache.uncomposedScene
                  })
                : null
              if (composition)
                nextStateJson = createNativeLiveSessionState(composition.scene).stateJson
              receipt = liveSessionWebSocketServerMessageDtoSchema.parse({
                type: 'COMMAND_COMMITTED',
                commandId,
                sequence: current.sequence + 1,
                delta: {
                  scope: 'CHARACTER_SHEET',
                  result: executed.acknowledgement
                }
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
                  checksumCanonicalJson(prepared.revisions) ||
                this.#cache !== sceneCache ||
                this.#presentationChanging
              )
                throw new RoomAdmissionExpiredError()
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
      )
      this.#authorization.applyCharacters(
        value.authorityEpoch,
        committedAuthorization.characters.map((entry) =>
          entry.characterId === character.characterId
            ? {
                ...entry,
                partyVisibility: result.facts?.sheetState.partyVisibility ?? entry.partyVisibility
              }
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
        if (!member || !admitsRoomMember(committedAuthorization, member)) continue
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
        // A Concentration end or death save card the command caused tells the whole table, as the
        // encounter route does.
        for (const entry of result.chatEntries)
          send(recipient, {
            type: 'COMMAND_COMMITTED',
            commandId,
            sequence: current.sequence + 1,
            delta: { scope: 'CAMPAIGN_CHAT', entry, privateRoll: null }
          })
        // A roll retained for the GM reaches that user's sockets alone.
        for (const { userId, roll } of result.privateRolls)
          if (userId === member.userId)
            send(recipient, {
              type: 'COMMAND_COMMITTED',
              commandId,
              sequence: current.sequence + 1,
              delta: { scope: 'CAMPAIGN_CHAT', entry: null, privateRoll: roll }
            })
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
      if (error instanceof EncounterDomainRejection) {
        this.#sendDomainRejection(socket, commandId, error)
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
      send(socket, replayReceipt(prior.receipt.receiptJson))
      return
    }
    try {
      const bucket = this.#bucket('TABLE', value, admission)
      if (!this.#buckets.admits(bucket)) throw new RoomRateLimitedError()
      if (this.#aggregateNeedsReload) await this.#flushOutbox('RELOAD')
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
      let replayed = false
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
            command: command.command,
            random: this.#random
          })
          replayed = posted.replayed
          receipt = liveSessionWebSocketServerMessageDtoSchema.parse({
            type: 'COMMAND_COMMITTED',
            commandId,
            sequence: current.sequence + 1,
            delta: {
              scope: 'CAMPAIGN_CHAT',
              entry: posted.entry,
              privateRoll: posted.privateRoll
            }
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
            throw new RoomAdmissionExpiredError()
          if (!receipt || entry.sequence !== current.sequence + 1)
            throw new Error('Room chat command sequence does not match its authority.')
          // A replayed entry spends nothing, as an exact retry in this epoch spends nothing.
          if (!replayed) this.#buckets.charge(bucket)
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
                  delta: {
                    scope: 'CAMPAIGN_CHAT',
                    entry: executed.entry,
                    privateRoll: null
                  }
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
      command.type === 'ROLL_ACTOR_INITIATIVE' ||
      (command.type === 'ROLL_ENEMY_ACTION' && command.visibility === 'PUBLIC')
        ? this.#bucket('TABLE', value, admission)
        : null
    try {
      if (tableBucket && !this.#buckets.admits(tableBucket)) throw new RoomRateLimitedError()
      if (this.#aggregateNeedsReload) await this.#flushOutbox('RELOAD')
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
      let checkpointBeforeAcknowledgement = false
      let nextSceneStateJson = current.stateJson
      const sceneCache = this.#cache
      const { result } = await this.#prepareWithRetry(authorization, (prepared, random) =>
        this.#roomStore.transact(
          async (transaction) => {
            const result = await executeRoomEncounterCommand({
              store: this.#roomStore,
              transaction,
              inputs: this.#roomInputs,
              authorization: prepared,
              campaignId: value.campaignId,
              epoch: value.authorityEpoch,
              userId: admission.userId,
              recipientUserIds: this.ctx.getWebSockets().flatMap((candidate) => {
                const member = this.#liveAdmission(candidate)
                return member && admitsRoomMember(prepared, member) ? [member.userId] : []
              }),
              command,
              presentedSceneId: sceneCache?.scene?.id ?? null,
              sceneTokens: this.#sceneTokens(value.authorityEpoch),
              random,
              ...(command.type === 'START' ||
              command.type === 'ADVANCE_TURN' ||
              command.type === 'RESOLVE_ACTION' ||
              command.type === 'RESOLVE_RULE_OCCURRENCE' ||
              command.type === 'VOID_RULE_OCCURRENCE' ||
              command.type === 'REMOVE_AREA_TARGET' ||
              command.type === 'ESCAPE_RELATIONSHIP' ||
              command.type === 'END_HELD_GRANT' ||
              command.type === 'RELEASE_RELATIONSHIP'
                ? {
                    turnExecution: { runtime: this.#liveRulesRuntime() }
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
            // An action's forced movement (D139) or its revert moved tokens on the presented Scene.
            const sceneHeader = sceneCache?.sceneHeader
              ? readRoomSceneHeader(transaction, sceneCache.sceneHeader.id)
              : null
            const sceneState =
              sceneHeader && sceneHeader.version !== sceneCache?.sceneHeader?.version
                ? await readRoomSceneState(transaction, sceneHeader.id)
                : null
            const uncomposedScene = sceneState?.scene ?? sceneCache?.uncomposedScene
            const composition = uncomposedScene
              ? await composeRoomSceneVision({
                  store: this.#roomStore,
                  transaction,
                  inputs: this.#roomInputs,
                  authorization: prepared,
                  campaignId: value.campaignId,
                  epoch: value.authorityEpoch,
                  scene: uncomposedScene
                })
              : null
            if (composition)
              nextSceneStateJson = createNativeLiveSessionState(composition.scene).stateJson
            return {
              ...result,
              composition,
              moved: sceneState && sceneHeader ? { ...sceneState, header: sceneHeader } : null
            }
          },
          (entry) => {
            const latest = this.#authorization.current(value.authorityEpoch)
            if (
              this.#liveAdmission(socket)?.generation !== admission.generation ||
              !latest ||
              checksumCanonicalJson(latest.revisions) !==
                checksumCanonicalJson(prepared.revisions) ||
              !admitsRoomMember(latest, admission)
            )
              throw new RoomAdmissionExpiredError()
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
              throw new Error(
                'Room command unexpectedly replayed inside its write-set transaction.'
              )
          }
        )
      )
      if (result.play) this.#authorization.applyPlay(value.authorityEpoch, result.play)
      if (result.composition && sceneCache) {
        this.#cache = {
          ...sceneCache,
          ...(result.play ? { encounterId: result.play.encounter?.encounterId ?? null } : {}),
          scene: result.composition.scene,
          characterRevisions: result.composition.characterRevisions,
          ...(result.moved
            ? {
                uncomposedScene: result.moved.scene,
                baseOrdinals: result.moved.baseOrdinals,
                sceneHeader: result.moved.header
              }
            : {})
        }
        if (!equalCanonicalJson(sceneCache.scene?.tokens, result.composition.scene.tokens))
          this.#broadcastStateSync()
      }
      if (result.checkpointBeforeAcknowledgement)
        await this.#checkpointThrough(value.authorityEpoch, current.sequence + 1, 'ACKNOWLEDGEMENT')
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
        // Roll cards the command posted to the TABLE reach every member in the commit, after the
        // result they belong to, on the same room sequence.
        for (const entry of result.chatEntries)
          send(recipientSocket, {
            type: 'COMMAND_COMMITTED',
            commandId: command.commandId,
            sequence: current.sequence + 1,
            delta: { scope: 'CAMPAIGN_CHAT', entry, privateRoll: null }
          })
        // A roll retained for the GM reaches that user's sockets alone.
        for (const { userId, roll } of result.privateRolls)
          if (userId === member.userId)
            send(recipientSocket, {
              type: 'COMMAND_COMMITTED',
              commandId: command.commandId,
              sequence: current.sequence + 1,
              delta: { scope: 'CAMPAIGN_CHAT', entry: null, privateRoll: roll }
            })
      }
      await this.#scheduleAlarm()
    } catch (error) {
      if (
        error instanceof EncounterDomainRejection ||
        error instanceof LiveSessionDomainRejectionError
      ) {
        this.#sendDomainRejection(socket, command.commandId, error)
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
    fingerprint: string
  ): Promise<EncounterCommandResultDto> {
    if (this.#cache && this.#cache.encounterId !== command.encounterId.toLowerCase())
      throw sceneNotPresentedRejection()
    const { encounter } = await this.#commitRoomGeometry(
      socket,
      admission,
      value,
      command,
      fingerprint
    )
    if (!encounter) throw new Error('A movement decision commit returned no Encounter result.')
    return encounter
  }

  /**
   * Stages one step of a GM fog patch (D79). Staging is not Scene state, so it neither journals nor
   * charges; the SCENE bucket must admit each step, and `PUBLISH_SCENE_FOG_PATCH` charges and
   * commits. A begin whose command already published reports that publication.
   */
  async #stageSceneFog(
    socket: WebSocket,
    admission: Admission,
    message: Extract<
      LiveSessionWebSocketClientMessageDto,
      { type: 'SCENE_FOG_BEGIN' | 'SCENE_FOG_APPEND' }
    >
  ): Promise<void> {
    if (this.#liveAdmission(socket)?.generation !== admission.generation) return
    const value = attachment(socket)
    const current = this.#journal.readCurrent()
    const commandId =
      message.type === 'SCENE_FOG_BEGIN' ? message.input.commandId : message.commandId
    if (
      !value ||
      !current ||
      current.authorityEpoch !== value.authorityEpoch ||
      current.status !== 'ACTIVE'
    ) {
      this.#rejectCommand(socket, commandId, 'AUTHORITY_CHANGED', 'Live Session authority changed.')
      return
    }
    if (admission.role !== 'OWNER') {
      this.#rejectCommand(socket, commandId, 'FORBIDDEN', 'Only the GM can change this Scene.')
      return
    }
    if (!this.#buckets.admits(this.#bucket('SCENE', value, admission))) {
      this.#rejectCommand(socket, commandId, 'RATE_LIMITED', new RoomRateLimitedError().message)
      return
    }
    const uploader = { epoch: value.authorityEpoch, userId: admission.userId }
    try {
      if (message.type === 'SCENE_FOG_APPEND') {
        send(socket, {
          type: 'SCENE_FOG_PROGRESS',
          progress: this.#fogUploads.append(uploader, commandId, message.input)
        })
        return
      }
      const { input } = message
      const scene = this.#cache?.scene ?? null
      if (!scene || scene.id !== input.sceneId || input.expectedSceneVersion > scene.version) {
        this.#rejectCommand(
          socket,
          commandId,
          'STALE_STATE',
          'Scene changed; the current state has been restored.',
          current.sequence,
          scene
            ? {
                scope: 'SCENE',
                state: projectSceneForViewer(
                  scene,
                  viewer(admission),
                  this.#boundTokenControl(scene, admission, value.authorityEpoch)
                )
              }
            : undefined
        )
        return
      }
      if (scene.fogMode === 'OFF')
        throw new RoomSceneCommandRefusal('INVALID_COMMAND', 'Fog of war is off for this Scene.')
      const published = await this.#roomStore.transact(async (transaction) =>
        readRoomSceneFogReceipt(transaction, input.sceneId, commandId)
      )
      if (published && published.inputChecksum !== checksumCanonicalJson(input))
        throw new RoomSceneCommandRefusal(
          'INVALID_COMMAND',
          'Command ID was already used with different input.'
        )
      send(socket, {
        type: 'SCENE_FOG_PROGRESS',
        progress: published
          ? {
              saveId: published.result.patch.saveId,
              sceneId: published.sceneId,
              commandId: published.commandId,
              status: 'PUBLISHED',
              receivedChunks: published.input.chunkManifest.length,
              totalChunks: published.input.chunkManifest.length
            }
          : this.#fogUploads.begin(uploader, input)
      })
      await this.#scheduleAlarm()
    } catch (error) {
      if (!(error instanceof RoomSceneCommandRefusal)) throw error
      this.#rejectCommand(socket, commandId, error.code, error.message)
    }
  }

  /**
   * An undo, inline edit or fog publication: its Scene rows, recomposed vision, replay evidence and
   * acknowledgement commit in one SQLite transaction (D79).
   */
  async #commitRoomSceneEdit(
    socket: WebSocket,
    admission: Admission,
    value: SocketAttachment,
    command: { sceneId: string; commandId: string },
    fingerprint: string,
    edit: RoomSceneEditWork,
    /** Runs inside the durable commit, with the journal receipt. */
    onDurable?: () => void
  ): Promise<void> {
    if (this.#aggregateNeedsReload) await this.#flushOutbox('RELOAD')
    await this.#loadRoomAggregate(command.sceneId)
    const cache = this.#cache
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
    if (!admitsRoomMember(authorization, admission)) throw new RoomAdmissionExpiredError()
    this.#roomStore.assertAuthorityHead({
      epoch: current.authorityEpoch,
      sequence: current.sequence,
      checksum: current.stateChecksum
    })
    let receipt: LiveSessionWebSocketServerMessageDto | null = null
    let nextStateJson: string | null = null
    const sequence = current.sequence + 1
    const { result: committed } = await this.#prepareWithRetry(authorization, (prepared) =>
      this.#roomStore.transact(
        async (transaction) => {
          const edited = await edit({
            transaction,
            authorization: prepared,
            scene: cache.uncomposedScene!,
            presentation: cache.presentation!
          })
          const composition = await composeRoomSceneVision({
            store: this.#roomStore,
            transaction,
            inputs: this.#roomInputs,
            authorization: prepared,
            campaignId: value.campaignId,
            epoch: value.authorityEpoch,
            scene: edited.scene
          })
          nextStateJson = createNativeLiveSessionState(composition.scene).stateJson
          receipt = liveSessionWebSocketServerMessageDtoSchema.parse(
            this.#sceneCommittedFor({
              admission,
              epoch: value.authorityEpoch,
              committed: { commandId: command.commandId, sequence },
              before,
              after: composition.scene,
              result: edited.result,
              occurrence: null
            })
          )
          return { ...edited, composition, receipt }
        },
        (entry) => {
          const latest = this.#authorization.current(value.authorityEpoch)
          if (
            !latest ||
            this.#liveAdmission(socket)?.generation !== admission.generation ||
            !admitsRoomMember(latest, admission) ||
            checksumCanonicalJson(latest.revisions) !== checksumCanonicalJson(prepared.revisions) ||
            this.#cache?.scene?.id !== before.id ||
            this.#cache.scene.version !== before.version ||
            this.#cache.presentation?.expectedPresentationVersion !==
              cache.presentation!.expectedPresentationVersion
          )
            throw new RoomAdmissionExpiredError()
          if (!receipt || !nextStateJson || entry.sequence !== sequence)
            throw new Error('Room Scene edit sequence does not match its authority.')
          this.#buckets.charge(this.#bucket('SCENE', value, admission))
          onDurable?.()
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
            throw new Error('Room Scene edit unexpectedly replayed inside its transaction.')
        }
      )
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
      { socket, message: committed.receipt }
    )
    if (committed.fogChanged) this.#broadcastStateSync()
    await this.#scheduleAlarm()
  }

  /** Geometry, fog, rules, replay evidence and acknowledgement commit in one SQLite transaction. */
  async #commitRoomGeometry(
    socket: WebSocket,
    admission: Admission,
    value: SocketAttachment,
    command: StagedSceneCommand,
    fingerprint: string
  ) {
    if (this.#aggregateNeedsReload) await this.#flushOutbox('RELOAD')
    await this.#loadRoomAggregate(this.#cache?.scene?.id ?? null)
    const context = this.#stagedSceneContext()
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
      throw new RoomAdmissionExpiredError()
    this.#roomStore.assertAuthorityHead({
      epoch: current.authorityEpoch,
      sequence: current.sequence,
      checksum: current.stateChecksum
    })
    const sequence = current.sequence + 1
    // A movement decision stores both messages its sender is sent: the Scene receipt, then the Encounter result.
    let receipt:
      | LiveSessionWebSocketServerMessageDto
      | [LiveSessionWebSocketServerMessageDto, LiveSessionWebSocketServerMessageDto]
      | null = null
    let nextStateJson: string | null = null
    const { result: committed } = await this.#prepareWithRetry(authorization, (prepared, random) =>
      this.#roomStore.transact(
        async (transaction) => {
          const result = await executeRoomSceneGeometry({
            store: this.#roomStore,
            transaction,
            inputs: this.#roomInputs,
            authorization: prepared,
            campaignId: value.campaignId,
            epoch: value.authorityEpoch,
            userId: admission.userId,
            command,
            context,
            sceneTokens: this.#sceneTokens(value.authorityEpoch),
            runtime: this.#liveRulesRuntime(),
            random
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
            authorization: prepared,
            campaignId: value.campaignId,
            epoch: value.authorityEpoch,
            scene: uncomposedScene
          })
          nextStateJson = createNativeLiveSessionState(composition.scene).stateJson
          const sent = liveSessionWebSocketServerMessageDtoSchema.parse(
            this.#sceneCommittedFor({
              admission,
              epoch: value.authorityEpoch,
              committed: { commandId: command.commandId, sequence },
              before,
              after: composition.scene,
              result: scene,
              occurrence: scene.occurrence
            })
          )
          // Only a movement decision commits an Encounter result; a Scene command's retry replays one message.
          if (
            (command.type === 'RESOLVE_RULE_OCCURRENCE' ||
              command.type === 'VOID_RULE_OCCURRENCE') !==
            (result.encounter !== null)
          )
            throw new Error('Only a movement decision commits an Encounter result.')
          receipt = result.encounter
            ? [
                sent,
                liveSessionWebSocketServerMessageDtoSchema.parse({
                  commandId: command.commandId,
                  delta: { scope: 'ENCOUNTER', result: result.encounter },
                  sequence,
                  type: 'COMMAND_COMMITTED'
                })
              ]
            : sent
          return {
            ...result,
            scene,
            sent,
            nextScene: composition.scene,
            uncomposedScene,
            characterRevisions: composition.characterRevisions,
            header: readRoomSceneHeader(transaction, before.id),
            play: await readRoomEncounterPlayAuthorization(
              { db: this.#roomStore.store },
              value.campaignId,
              prepared.play,
              before.id
            )
          }
        },
        (entry) => {
          const latest = this.#authorization.current(value.authorityEpoch)
          if (
            this.#liveAdmission(socket)?.generation !== admission.generation ||
            !latest ||
            checksumCanonicalJson(latest.revisions) !== checksumCanonicalJson(prepared.revisions) ||
            !admitsRoomMember(latest, admission) ||
            this.#cache?.scene?.id !== before.id ||
            this.#cache.scene.version !== before.version ||
            this.#cache.presentation?.expectedPresentationVersion !==
              context.presentation.expectedPresentationVersion
          )
            throw new RoomAdmissionExpiredError()
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
      { socket, message: committed.sent }
    )
    if (committed.fogChanged || !equalCanonicalJson(before.tokens, committed.nextScene.tokens))
      this.#broadcastStateSync()
    await this.#scheduleAlarm()
    return committed
  }

  /** The room's presented Scene that geometry commands plan against; null while none is presented. */
  #stagedSceneContext(): StagedSceneContext | null {
    const cached = this.#cache
    if (!cached?.scene || !cached.presentation) return null
    return {
      scene: cached.scene,
      baseOrdinals: cached.baseOrdinals,
      characterRevisions: cached.characterRevisions,
      presentation: cached.presentation
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
    const fingerprint = checksumCanonicalJson({
      command,
      scope: 'ENCOUNTER_BINDING'
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
    const cached = this.#cache
    if (!cached?.scene || !cached.presentation) {
      this.#rejectCommand(
        socket,
        commandId,
        'UNAVAILABLE',
        'The presented Scene is not available yet; try again.'
      )
      return
    }
    const sceneId = cached.scene.id
    const { presentation } = cached
    try {
      if (this.#aggregateNeedsReload) await this.#flushOutbox('RELOAD')
      await this.#loadRoomAggregate(sceneId)
      const current = this.#journal.readCurrent()
      if (!current || current.authorityEpoch !== value.authorityEpoch)
        throw new LiveSessionRouteError(409)
      const authorization = await this.#authorizationBoundary(value)
      if (
        !cached.uncomposedScene ||
        this.#liveAdmission(socket)?.generation !== admission.generation ||
        !admitsRoomMember(authorization, admission)
      )
        throw new RoomAdmissionExpiredError()
      this.#roomStore.assertAuthorityHead({
        epoch: current.authorityEpoch,
        sequence: current.sequence,
        checksum: current.stateChecksum
      })
      const sequence = current.sequence + 1
      let receipt: LiveSessionWebSocketServerMessageDto | null = null
      let nextStateJson: string | null = null
      const { result, authorization: committedAuthorization } = await this.#prepareWithRetry(
        authorization,
        (prepared) =>
          this.#roomStore.transact(
            async (transaction) => {
              const bound = await executeRoomSceneBinding({
                store: this.#roomStore,
                transaction,
                inputs: this.#roomInputs,
                authorization: prepared,
                campaignId: value.campaignId,
                epoch: value.authorityEpoch,
                userId: admission.userId,
                sceneId,
                expectedPresentationVersion: presentation.expectedPresentationVersion,
                command
              })
              const encounterId = bound.play
                ? (bound.play.encounter?.encounterId ?? null)
                : cached.encounterId
              const composition = await composeRoomSceneVision({
                store: this.#roomStore,
                transaction,
                inputs: this.#roomInputs,
                authorization: prepared,
                campaignId: value.campaignId,
                epoch: value.authorityEpoch,
                scene: cached.uncomposedScene!
              })
              nextStateJson = createNativeLiveSessionState(composition.scene).stateJson
              receipt = liveSessionWebSocketServerMessageDtoSchema.parse({
                commandId,
                delta: { scope: 'ENCOUNTER_BINDING', result: bound.result },
                sequence,
                type: 'COMMAND_COMMITTED'
              })
              return { ...bound, encounterId, composition }
            },
            (entry) => {
              const latest = this.#authorization.current(value.authorityEpoch)
              if (
                !latest ||
                this.#liveAdmission(socket)?.generation !== admission.generation ||
                !admitsRoomMember(latest, admission) ||
                checksumCanonicalJson(latest.revisions) !==
                  checksumCanonicalJson(prepared.revisions) ||
                this.#cache?.scene?.id !== sceneId ||
                this.#cache.presentation?.expectedPresentationVersion !==
                  presentation.expectedPresentationVersion
              )
                throw new RoomAdmissionExpiredError()
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
      )
      if (result.play) this.#authorization.applyPlay(value.authorityEpoch, result.play)
      this.#cache = {
        ...cached,
        encounterId: result.encounterId,
        scene: result.composition.scene,
        characterRevisions: result.composition.characterRevisions
      }
      if (!receipt) throw new Error('Committed room binding receipt is unavailable.')
      for (const member of this.ctx.getWebSockets()) {
        const active = this.#liveAdmission(member)
        if (active && admitsRoomMember(committedAuthorization, active)) send(member, receipt)
      }
      this.#broadcastStateSync()
      await this.#scheduleAlarm()
    } catch (error) {
      this.#rejectSceneCommand(socket, commandId, error, undefined)
    }
  }

  /** Maps a failed Scene command to its user-safe rejection. */
  #rejectSceneCommand(
    socket: WebSocket,
    commandId: string,
    error: unknown,
    correction: LiveSessionCorrectionDto | undefined
  ): void {
    if (
      error instanceof LiveSessionDomainRejectionError ||
      error instanceof EncounterDomainRejection
    ) {
      this.#sendDomainRejection(socket, commandId, error, correction)
      return
    }
    if (error instanceof RoomRateLimitedError) {
      this.#rejectCommand(socket, commandId, 'RATE_LIMITED', error.message)
      return
    }
    if (error instanceof RetryableCommandError) {
      const refusal = encounterCommandRefusal(error)
      this.#rejectCommand(
        socket,
        commandId,
        refusal.code,
        refusal.message,
        this.#journal.readCurrent()?.sequence ?? 0,
        correction
      )
      return
    }
    if (error instanceof RoomSceneCommandRefusal) {
      this.#rejectCommand(
        socket,
        commandId,
        error.code,
        error.message,
        this.#journal.readCurrent()?.sequence ?? 0,
        error.code === 'STALE_STATE' ? correction : undefined
      )
      return
    }
    // A failure inside the room tells the member nothing, so the room logs it (as Encounter commands do).
    if (!(error instanceof LiveSessionRouteError))
      console.error('Live Session Scene command failed in the room.', error)
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

  /** Whether a member's command requires geometry planning on the presented Scene. */
  #isStagedCommand(command: unknown): boolean {
    const parsed = liveSessionSceneCommandInputSchema.safeParse(command)
    const cached = this.#cache
    return (
      parsed.success &&
      !!cached?.scene &&
      isStagedSceneCommand(parsed.data, cached.scene, cached.encounterId)
    )
  }

  /**
   * Runs one command's preparation-and-commit transaction. When an input changed mid-preparation the
   * transaction rolled back, so it runs again against freshly reloaded authorization (bounded; see
   * `retryPreparation`). Returns the authorization the committing attempt used.
   */
  async #prepareWithRetry<T>(
    authorization: LiveSessionRoomAuthorization,
    run: (
      authorization: LiveSessionRoomAuthorization,
      random: (maximum: number) => number
    ) => Promise<T>
  ): Promise<{ result: T; authorization: LiveSessionRoomAuthorization }> {
    let prepared = authorization
    const result = await retryPreparation(
      this.#random,
      async () => {
        prepared = await this.#refreshAuthorization()
      },
      (random) => run(prepared, random)
    )
    return { result, authorization: prepared }
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
   * changed (D73) and the Encounter sessions whose frame changed. It queues behind the running command, so the command's own receipt reaches its
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
        // The departures may have journaled, so the sweep reads the head afresh.
        const head = this.#journal.readCurrent()
        if (head?.status === 'ACTIVE') await this.#endBrokenRelationships(head)
      } catch (error) {
        console.error('Live Session relationship end sweep failed.', error)
      }
      if (
        this.#sheetFeed.size === 0 &&
        this.#encounterFeed.size === 0 &&
        this.#summaryFeed.size === 0
      )
        return
      try {
        if (this.#aggregateNeedsReload) await this.#flushOutbox('RELOAD')
        await this.#loadRoomAggregate(this.#cache?.scene?.id ?? null)
      } catch (error) {
        // Without the held aggregate a push would misreport what the room holds.
        console.error('Live Session push aggregate load failed.', error)
        return
      }
      try {
        await this.#sheetFeed.push()
      } catch (error) {
        console.error('Live Session Sheet push failed.', error)
      }
      try {
        await this.#encounterFeed.push()
      } catch (error) {
        console.error('Live Session Encounter session push failed.', error)
      }
      try {
        await this.#summaryFeed.push()
      } catch (error) {
        console.error('Live Session Campaign summary push failed.', error)
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
    if (this.#aggregateNeedsReload) await this.#flushOutbox('RELOAD')
    const departures = await readRoomActorDepartures(
      this.#roomStore,
      this.#roomInputs,
      authorization
    )
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
      await this.#checkpointThrough(current.authorityEpoch, sequence, 'ACKNOWLEDGEMENT')
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

  /**
   * One journaled transaction, only when an ACTIVE Run holds a relationship whose hold broke on its
   * own (D152): its source can't act, or a movement left the held creature beyond the sealed reach.
   */
  async #endBrokenRelationships(
    current: NonNullable<ReturnType<DurableCommandJournal['readCurrent']>>
  ): Promise<void> {
    const authorization = this.#authorization.current(current.authorityEpoch)
    if (!authorization) return
    if (this.#aggregateNeedsReload) await this.#flushOutbox('RELOAD')
    const campaignId = this.#roomCampaignId()
    if (!campaignId) throw new Error('Live Session Campaign is unavailable.')
    const scope = {
      store: this.#roomStore,
      inputs: this.#roomInputs,
      authorization,
      campaignId,
      epoch: current.authorityEpoch
    }
    if (!(await roomHasBrokenRelationships(scope))) return
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
    await this.#roomStore.transact(
      (transaction) =>
        endRoomBrokenRelationships({
          ...scope,
          transaction,
          commandId,
          occurredAt: new Date().toISOString()
        }),
      (entry) => {
        if (this.#authorization.current(current.authorityEpoch) !== authorization)
          throw new Error('Room relationship end authorization changed before commit.')
        if (entry.sequence !== sequence)
          throw new Error('Room relationship end sequence does not match its authority.')
        const committed = this.#journal.commitInTransaction({
          actorId: current.authorityEpoch,
          authorityEpoch: current.authorityEpoch,
          commandId,
          fingerprint: checksumCanonicalJson({ type: 'RELATIONSHIPS_ENDED', sequence }),
          expectedSequence: current.sequence,
          expectedStateChecksum: current.stateChecksum,
          nextStateChecksum: entry.chainChecksum,
          nextStateJson: current.stateJson,
          receiptJson: JSON.stringify(receipt),
          checkpointBeforeAcknowledgement: false
        })
        if (committed.kind !== 'COMMITTED')
          throw new Error('Room relationship end unexpectedly replayed inside its transaction.')
      }
    )
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
    const play = await readRoomEncounterPlayAuthorization(
      { db: this.#roomStore.store },
      campaignId,
      authorization.play,
      sceneId ?? null
    )
    const nativeCharacters = new Map(
      this.#roomStore.documents('characterPlayStates').map((row) => [row.characterId, row])
    )
    const characters = authorization.characters.map((character) => {
      const local = nativeCharacters.get(character.characterId)
      if (!local) return character
      if (local.userId !== character.ownerUserId)
        throw new Error('Room Character visibility owner mismatch.')
      return {
        ...character,
        partyVisibility: readCharacterPlay(local).partyVisibility
      }
    })
    this.#authorization.applyCharacters(head.authorityEpoch, characters)
    if (play) this.#authorization.applyPlay(head.authorityEpoch, play)
    return { ...authorization, characters, play: play ?? authorization.play }
  }

  #liveRulesRuntime(): RulesRuntimeService {
    this.#rulesRuntime ??= createNativeLiveRulesRuntime()
    return this.#rulesRuntime
  }

  /**
   * Sends one committed Scene command to every member, projected for each. The `sender` is sent
   * the message already built for its stored receipt, so projection runs once per viewer and a
   * retry replays exactly what it received; a member who cannot see the change gets the version bump.
   */
  #broadcastSceneCommitted(
    committed: { commandId: string; sequence: number },
    before: CampaignSceneStateDto,
    after: CampaignSceneStateDto,
    result: SceneCommandResultDto,
    sender: { socket: WebSocket; message: LiveSessionWebSocketServerMessageDto }
  ): void {
    for (const socket of this.ctx.getWebSockets()) {
      const admission = this.#liveAdmission(socket)
      const epoch = attachment(socket)?.authorityEpoch
      if (!admission || !epoch) continue
      send(
        socket,
        socket === sender.socket
          ? sender.message
          : this.#sceneCommittedFor({
              admission,
              epoch,
              committed,
              before,
              after,
              result,
              occurrence: null
            })
      )
    }
  }

  /**
   * The committed Scene command as `admission` receives it. The sender's stored receipt is this
   * message, so an exact retry replays what the sender was sent, never the raw delta. When a
   * movement decision settles, `#commitRoomGeometry` stores it ahead of the Encounter result.
   */
  #sceneCommittedFor({
    admission,
    epoch,
    committed,
    before,
    after,
    result,
    occurrence
  }: {
    admission: Pick<Admission, 'role' | 'userId'>
    epoch: string
    committed: { commandId: string; sequence: number }
    before: CampaignSceneStateDto
    after: CampaignSceneStateDto
    result: SceneCommandResultDto
    occurrence: SceneCommandResultDto['occurrence']
  }): LiveSessionWebSocketServerMessageDto {
    const delta = result.delta
      ? projectSceneDeltaForViewer(
          before,
          after,
          viewer(admission),
          result.delta,
          this.#boundTokenControl(after, admission, epoch)
        )
      : null
    return {
      ...committed,
      delta: delta
        ? { scope: 'SCENE', result: { ...result, delta, occurrence } }
        : after.version !== before.version
          ? {
              scope: 'SCENE_VERSION',
              sceneId: result.sceneId,
              version: result.version
            }
          : occurrence
            ? { scope: 'SCENE', result: { ...result, occurrence } }
            : null,
      type: 'COMMAND_COMMITTED'
    }
  }
  /** The one mapping of a domain rejection, Encounter or Live Session, to its socket refusal. */
  #sendDomainRejection(
    socket: WebSocket,
    commandId: string,
    error: EncounterDomainRejection | LiveSessionDomainRejectionError,
    correction?: LiveSessionCorrectionDto
  ): void {
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

  /**
   * A failure inside the room tells the member only to retry, so the room logs its cause; a Convex route
   * status is expected and not logged (as Encounter and Scene commands do).
   */
  #rejectRoomFailure(
    socket: WebSocket,
    commandId: string,
    error: unknown,
    message = LIVE_SESSION_TRY_AGAIN_MESSAGE
  ): void {
    if (!(error instanceof LiveSessionRouteError))
      console.error('Live Session command failed in the room.', error)
    this.#rejectCommand(socket, commandId, 'UNAVAILABLE', message)
  }

  /** Admissions and drains retry a retained checkpoint; commands save at save points and at the backlog bound. */
  #publishInBackground(): void {
    this.ctx.waitUntil(this.#flushOutbox('ADMISSION').catch(() => undefined))
  }

  /** `reason` is the trigger a checkpoint this flush sends is attributed to; see `RoomMeter`. */
  #flushOutbox(reason: LiveSessionCheckpointReason): Promise<void> {
    if (this.#outboxFlush) return this.#outboxFlush
    const work = this.#publishPending(reason)
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
  async #checkpointThrough(
    epoch: string,
    sequence: number,
    reason: LiveSessionCheckpointReason
  ): Promise<void> {
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
      await this.#flushOutbox(reason)
    }
  }

  /** Publishes every committed command and returns the sequence Convex now holds, or null with no live head. */
  async #publishThroughHead(): Promise<number | null> {
    const head = this.#journal.readCurrent()
    if (!head || head.status === 'RELEASED') return null
    await this.#checkpointThrough(head.authorityEpoch, head.sequence, 'BARRIER')
    return head.sequence
  }

  async #publishPending(reason: LiveSessionCheckpointReason): Promise<void> {
    // Backlog and admission flushes run beside the command chain, so the head is read between commands.
    const scope = await this.#roomStore.whenClosed(() => {
      const current = this.#journal.readCurrent()
      const campaignId = this.#roomCampaignId()
      if (!current || !campaignId || current.status === 'RELEASED') return null
      if (this.#roomStore.epoch !== current.authorityEpoch) {
        if (current.sequence !== current.publishedSequence)
          throw new Error('The pending checkpoint has no matching room aggregate.')
        return null
      }
      if (
        current.sequence === current.publishedSequence &&
        (this.#roomStore.sequence !== current.sequence ||
          this.#roomStore.checksum !== current.stateChecksum)
      )
        return null // An acknowledged Convex-first command reloads its aggregate at the next boundary.
      this.#roomStore.assertAuthorityHead({
        epoch: current.authorityEpoch,
        sequence: current.sequence,
        checksum: current.stateChecksum
      })
      return { current, campaignId }
    })
    if (!scope) return
    const { current, campaignId } = scope
    const sent = this.#authorization.current(current.authorityEpoch)?.revisions ?? null
    const response = await this.#checkpoints.flush(
      { campaignId, epoch: current.authorityEpoch, knownAuthorization: sent },
      reason
    )
    if (response) {
      const head = this.#journal.readCurrent()
      if (head && head.sequence === head.publishedSequence)
        this.#authorization.acknowledgePlay(current.authorityEpoch)
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

  /** Rebuilds a missing or stale Scene cache in the background. */
  #refreshPreviewScene(value: SocketAttachment): void {
    this.#refreshPreviewInBackground('scene', async () => {
      await this.#refreshSceneCache(value, true)
      const sceneId = this.#cache?.scene?.id
      if (sceneId) this.#overlayDurableSceneCache(sceneId)
    })
  }

  /**
   * The Scene vision was built from Character revisions the authorization cache no longer holds
   * (D33). The cache reloads first; a Character that really changed rebuilds the Scene's vision.
   */
  #refreshPreviewVision(value: SocketAttachment): void {
    this.#refreshPreviewInBackground('scene', async () => {
      const authorization = await this.#refreshAuthorization()
      if (!roomVisionCurrent(authorization, this.#cache?.characterRevisions ?? []))
        await this.#refreshSceneCache(value, true)
    })
  }

  /**
   * The only save that is not a lifecycle moment (ADR 0035 Amendment 25): when the unsaved log holds
   * a chat push window of new chat entries and roll cards, the room saves in the background, so
   * Convex chat paging never has a gap. The journal's size is not a trigger: a checkpoint pages
   * itself, so one save stays one page however large the backlog. It runs after the commit, so it
   * never delays an acknowledgement. A flush already running carries the log, and a failed one waits
   * `alarmRetryMs` because the bound stays crossed.
   */
  #saveBacklogIfFull(): void {
    if (this.#roomStore.unsavedChatEntries < LIVE_SESSION_PUSHED_CHAT_ENTRY_LIMIT) return
    if (this.#outboxFlush || Date.now() < this.#backlogRetryAt) return
    this.ctx.waitUntil(
      this.#flushOutbox('BACKLOG').catch((error) => {
        this.#backlogRetryAt = Date.now() + ROOM_LIMITS.alarmRetryMs
        console.error('Live Session backlog save failed.', error)
      })
    )
  }

  /**
   * The lease renews here, never in a checkpoint: one background read per half-lease, started by a
   * message or an alarm that is already running, and only while a socket is connected. An idle room
   * with no sockets lets the lease lapse, and the next admission reads anyway (ADR 0035 Amendment 18).
   */
  #renewAuthorizationIfDue(): void {
    if (this.#authorization.renewalDue() && this.#openSockets().length > 0)
      this.#refreshAuthorizationInBackground()
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

  /**
   * Builds the presented-Scene cache when the room holds none (a first admission, or one after the
   * cache was discarded), so no socket is synced without a Scene that is presented. The Scene rows
   * are the room's own; Convex supplies only the pointer and what the rows are composed with.
   */
  async #ensureSceneCache(value: SocketAttachment): Promise<void> {
    if (this.#cache) return
    const capture = await this.#refreshSceneCache(value, true)
    if (capture?.sceneHeader) this.#overlayDurableSceneCache(capture.sceneHeader.id)
  }

  /**
   * The presented Scene from the room's own rows, composed with Character vision. The room's Scene
   * rows are loaded from Convex first when the store does not hold this Scene (D78).
   */
  async #hydrateSceneCache(
    value: SocketAttachment,
    capture: LiveSessionRoomSceneCapture,
    serialized: boolean
  ) {
    // Off-chain refreshes queue behind a running command: the room store runs one at a time.
    const source = { sceneHeader: capture.sceneHeader }
    if (!serialized) return this.#buildSceneCache(value, source)
    const next = this.#commandChain.then(() => this.#buildSceneCache(value, source))
    this.#commandChain = next.then(
      () => undefined,
      () => undefined
    )
    return next
  }

  /** The Scene rows composed with Character vision: all of a cache that its persisted part does not hold. */
  async #buildSceneCache(
    scope: Pick<SocketAttachment, 'authorityEpoch' | 'campaignId'>,
    { sceneHeader: header }: Pick<TransientCache, 'sceneHeader'>
  ) {
    if (!header)
      return {
        baseOrdinals: { tokens: [], barriers: [] },
        characterRevisions: [],
        scene: null,
        uncomposedScene: null
      }
    await this.#loadRoomAggregate(header.id)
    const authorization = await this.#authorizationBoundary(scope)
    return this.#roomStore.transact(async (transaction) => {
      const { scene: uncomposedScene, baseOrdinals } = await readRoomSceneState(
        transaction,
        header.id
      )
      if (uncomposedScene.version < header.version)
        throw new Error('Room Scene rows are older than the presented Scene.')
      const composition = await composeRoomSceneVision({
        store: this.#roomStore,
        transaction,
        inputs: this.#roomInputs,
        authorization,
        campaignId: scope.campaignId,
        epoch: scope.authorityEpoch,
        scene: uncomposedScene
      })
      return {
        baseOrdinals,
        characterRevisions: composition.characterRevisions,
        scene: composition.scene,
        uncomposedScene
      }
    })
  }

  async #refreshSceneCache(
    value: SocketAttachment,
    serialized = false
  ): Promise<LiveSessionRoomSceneCapture | null> {
    if (this.#presentationChanging) return null
    // Convex holds the room's commands before the capture: hydration would otherwise publish them
    // between the two captures, and the refresh would read its own checkpoint as a change.
    const head = this.#journal.readCurrent()
    if (head && head.sequence !== head.publishedSequence)
      await this.#checkpointThrough(head.authorityEpoch, head.sequence, 'RELOAD')
    const generation = this.#cacheGeneration
    let staleRetryUsed = false
    let capture: LiveSessionRoomSceneCapture
    try {
      capture = await this.#capture(value, this.#cache?.characterRevisions ?? [])
    } catch (error) {
      if (!(error instanceof LiveSessionRouteError) || error.status !== 409) throw error
      if (generation !== this.#cacheGeneration || this.#presentationChanging) return null
      staleRetryUsed = true
      this.#cache = null
      capture = await this.#capture(value, [])
    }
    if (generation !== this.#cacheGeneration || this.#presentationChanging) return null
    const key = cacheKey(capture)
    if (this.#cache?.key === key) return capture

    const hydrated = await this.#hydrateSceneCache(value, capture, serialized)
    let scene = hydrated.scene
    let uncomposedScene = hydrated.uncomposedScene
    let revisions = hydrated.characterRevisions
    let baseOrdinals = hydrated.baseOrdinals
    let finalCapture: LiveSessionRoomSceneCapture
    try {
      finalCapture = await this.#capture(value, revisions)
    } catch (error) {
      if (!(error instanceof LiveSessionRouteError) || error.status !== 409) throw error
      if (generation !== this.#cacheGeneration || this.#presentationChanging) return null
      if (staleRetryUsed) throw error
      staleRetryUsed = true
      this.#cache = null
      const retry = await this.#capture(value, [])
      const hydratedRetry = await this.#hydrateSceneCache(value, retry, serialized)
      scene = hydratedRetry.scene
      uncomposedScene = hydratedRetry.uncomposedScene
      revisions = hydratedRetry.characterRevisions
      baseOrdinals = hydratedRetry.baseOrdinals
      finalCapture = await this.#capture(value, revisions)
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
      scene,
      uncomposedScene,
      sceneHeader: finalCapture.sceneHeader,
      presentation: finalCapture.presentation
        ? { expectedPresentationVersion: finalCapture.presentation.version }
        : null
    }
    return finalCapture
  }

  /** The room's Scene from Convex, authorized by the room's epoch: no member's token is needed. */
  async #capture(
    value: SocketAttachment,
    observedCharacterRevisions: LiveSessionRoomSceneCapture['observedCharacterRevisions']
  ): Promise<LiveSessionRoomSceneCapture> {
    return callLiveSessionRoute(this.env, null, 'roomSceneCapture', {
      campaignId: value.campaignId,
      epoch: value.authorityEpoch,
      observedCharacterRevisions
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
      this.#storage.sql
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
    this.#encounterFeed.drop(socket)
    this.#summaryFeed.drop(socket)
    // A challenged or closed socket must not be restored by a later wake.
    const value = socket.readyState === WebSocket.OPEN ? attachment(socket) : null
    if (value && (value.admissionDeadline !== null || value.feeds !== null))
      socket.serializeAttachment({
        ...value,
        admissionDeadline: null,
        feeds: null
      })
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
    this.#expiring.delete(socket)
    this.#budgets.delete(socket)
    this.#previewStreams.delete(socket)
  }

  async #presentScene(input: LiveSessionPresentationControlInput) {
    if (this.#activation) await this.#activation
    this.#presentationChanging = true
    this.#bumpCacheGeneration()
    this.#movementIndexes.clear()
    try {
      await this.#flushOutbox('PRESENTATION')
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
    await this.#checkpointThrough(fence.authorityEpoch, fence.finalSequence, 'DRAIN')
    try {
      await callLiveSessionRoute(this.env, null, 'release', input)
    } catch (error) {
      throw drainError ?? error
    }
    this.#journal.release(fence)
    this.#meter.release()
    this.#buckets.clear()
    this.#fogUploads.clear()
    // The next admitted socket bootstraps a fresh epoch over the released journal.
    this.#activation = null
    this.#storage.sql.exec('DELETE FROM room_idle_release WHERE id = 1')
    return closed
  }

  /**
   * Campaign deletion removes everything the room kept, Encounter and Scene history included
   * (ADR 0035 Amendments 22 and 26). It runs after `#closeRoom` released authority, so nothing
   * writes afterward. A fresh instance over the emptied storage answers a repeat the same way.
   */
  async #deleteRoomStorage(): Promise<void> {
    await this.ctx.storage.deleteAlarm()
    await this.ctx.storage.deleteAll()
    this.#storageDeleted = true
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
   * Cached Scene state belongs to one generation; a bump discards it, and the bound Encounter's
   * actor control reloads before previews use it.
   */
  #bumpCacheGeneration(): void {
    this.#cacheGeneration += 1
    this.#cache = null
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
