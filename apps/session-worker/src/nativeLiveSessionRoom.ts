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
import type { LiveSessionRoomSceneCapture } from '@artificer-toolkit/schema/api/liveSessionTransient'
import type { LiveSessionRoomAuthorization } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import { scenePresentationFenceSchema } from '@artificer-toolkit/schema/api/sceneGeometry'
import { sceneLiveStateHeaderSchema } from '@artificer-toolkit/schema/api/sceneLiveState'
import { withCharacterControllers } from '@artificer-toolkit/shared/campaign/characterControl'
import {
  LIVE_SESSION_PUSHED_CHAT_ENTRY_LIMIT,
  LIVE_SESSION_TRY_AGAIN_MESSAGE
} from '@artificer-toolkit/schema/api/liveSessionCommands'
import { readSceneHoldingDecision } from '@artificer-toolkit/encounter-persistence/occurrenceOwner'
import {
  sceneCommandResultDtoSchema,
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
  sceneTransientStreamKey,
  type ScenePoint
} from '@artificer-toolkit/shared/vtt'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { z } from 'zod'
import { DurableCommandJournal } from './durableCommandJournal.js'
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
import { encounterCommandRefusal, RoomAdmissionExpiredError } from './nativeRoomEncounterCommand.js'
import { RetryableCommandError } from './nativeRulesRevisions.js'
import { retryPreparation } from './roomPreparationRetry.js'
import { createNativeLiveRulesRuntime, secureRandomInt } from './nativeRulesRuntime.js'
import { RoomEncounterStore } from './roomEncounterStore.js'
import { RoomTestDice } from './roomTestDice.js'
import { RoomInputs } from './roomInputs.js'
import { RoomCheckpoints } from './roomCheckpoints.js'
import { publishRoomCheckpoint } from './roomCheckpointPublication.js'
import { meterStorage, RoomMeter, sqlRoomMeterStore } from './roomMeter.js'
import { persistRoomSceneCommand } from './roomSceneCommandPersistence.js'
import { commitRoomGeometry, commitRoomSceneEdit, stageSceneFog } from './roomSceneCommit.js'
import type { RoomCommandHost } from './roomCommandHost.js'
import { executeEncounterCommand } from './roomEncounterExecution.js'
import { executeEncounterBinding } from './roomEncounterBindingCommand.js'
import {
  accountBucket,
  attachment,
  replayReceipt,
  send,
  viewer,
  type Admission,
  type SocketAttachment,
  type TransientCache
} from './roomSocket.js'
import { readRoomSceneState } from './roomSceneRead.js'
import { composeRoomSceneVision } from './roomSceneVision.js'
import { RoomAdmissions } from './roomAdmissions.js'
import { RoomStorageAuthority } from './roomStorageAuthority.js'
import { journalInputReload, loadRoomAggregate, reloadRoomAggregate } from './roomAggregateLoad.js'
import { endBrokenRelationships, reconcileActorDepartures } from './roomActorSweeps.js'
import { restoreLocalPlayAuthorization } from './roomLocalPlayAuthorization.js'
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
  RoomSceneCommandRefusal
} from './roomSceneEdits.js'
import { RoomSceneFogUploads } from './roomSceneFogUploads.js'
import { executeCharacterSheetCommand } from './roomCharacterSheetCommands.js'
import { executeCampaignChatCommand } from './roomChatCommands.js'
import { RoomAccountBuckets, RoomRateLimitedError } from './roomRateLimits.js'
import { RoomCharacterSheetFeed, type FeedScope } from './roomCharacterSheetFeed.js'
import type { RoomSceneTokens } from './roomEncounterReadPorts.js'
import { RoomEncounterReads } from './roomEncounterReads.js'
import { RoomCampaignSummaryFeed } from './roomCampaignSummaryFeed.js'
import { RoomEncounterSessionFeed } from './roomEncounterSessionFeed.js'
import { loadRoomContentSnapshots } from './roomContentSnapshots.js'
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
import { verifyLiveSessionTicket } from './ticket.js'

const INTERNAL_TICKET_HEADER = 'x-artificer-live-session-ticket'

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
  readonly #host: RoomCommandHost
  #postCommitQueued = false
  readonly #checkpoints: RoomCheckpoints
  #aggregateNeedsReload = false
  #reloadQueued = false
  /** A failed backlog save is not retried before this time. */
  #backlogRetryAt = 0
  readonly #movementIndexes = new Map<
    string,
    { barriers: CampaignSceneStateDto['barriers']; index: SceneBarrierIndex }
  >()
  readonly #authority: RoomStorageAuthority
  readonly #admissions: RoomAdmissions
  /** Set once Campaign deletion emptied the storage; this instance then answers nothing else. */
  #storageDeleted = false
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
      (entry) => journalInputReload(this.#host, entry)
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
      env: this.env,
      storage: this.#storage,
      checkpoints: this.#checkpoints,
      store: this.#roomStore,
      inputs: this.#roomInputs,
      authorize: (scope: FeedScope) => this.#authorizationBoundary(scope),
      admission: (socket: WebSocket) => this.#admissions.liveAdmission(socket),
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
    this.#host = {
      env: this.env,
      storage: this.#storage,
      checkpoints: this.#checkpoints,
      store: this.#roomStore,
      inputs: this.#roomInputs,
      journal: this.#journal,
      buckets: this.#buckets,
      authorization: this.#authorization,
      fogUploads: this.#fogUploads,
      cache: () => this.#cache,
      setCache: (cache) => {
        this.#cache = cache
      },
      aggregateNeedsReload: () => this.#aggregateNeedsReload,
      flushOutbox: (reason) => this.#flushOutbox(reason),
      loadRoomAggregate: (sceneId) => loadRoomAggregate(this.#host, sceneId),
      setAggregateNeedsReload: (value) => {
        this.#aggregateNeedsReload = value
      },
      refreshSceneCache: (value) => this.#refreshSceneCache(value),
      roomCampaignId: () => this.#roomCampaignId(),
      bumpCacheGeneration: () => this.#bumpCacheGeneration(),
      challenge: (socket) => this.#admissions.challenge(socket),
      authorizationBoundary: (value) => this.#authorizationBoundary(value),
      prepareWithRetry: (authorization, run) => this.#prepareWithRetry(authorization, run),
      liveAdmission: (socket) => this.#admissions.liveAdmission(socket),
      sceneTokens: (epoch) => this.#sceneTokens(epoch),
      liveRulesRuntime: () => this.#liveRulesRuntime(),
      sceneCommittedFor: (input) => this.#sceneCommittedFor(input),
      broadcastSceneCommitted: (...args) => this.#broadcastSceneCommitted(...args),
      broadcastStateSync: () => this.#broadcastStateSync(),
      scheduleAlarm: () => this.#scheduleAlarm(),
      rejectCommand: (...args) => this.#rejectCommand(...args),
      webSockets: () => this.ctx.getWebSockets(),
      commandsSettled: () => this.#commandChain,
      afterCommands: (run) => {
        const result = this.#commandChain.then(run)
        this.#commandChain = result.then(
          () => undefined,
          () => undefined
        )
        return result
      },
      outboxFlushing: () => this.#outboxFlush,
      closeRoomSockets: (reason) => {
        this.#closeSockets({ type: 'CLOSE_ROOM' }, reason)
      },
      presentationChanging: () => this.#presentationChanging,
      random: this.#random,
      checkpointThrough: (epoch, sequence, reason) =>
        this.#checkpointThrough(epoch, sequence, reason),
      rejectRoomFailure: (...args) => this.#rejectRoomFailure(...args),
      rejectSceneCommand: (...args) => this.#rejectSceneCommand(...args),
      sendDomainRejection: (...args) => this.#sendDomainRejection(...args),
      controlledScene: (scene, epoch) => this.#controlledScene(scene, epoch),
      boundTokenControl: (scene, admission, epoch) =>
        this.#boundTokenControl(scene, admission, epoch)
    }
    this.#authority = new RoomStorageAuthority(this.#host)
    this.#admissions = new RoomAdmissions({
      ...this.#host,
      meter: this.#meter,
      authority: this.#authority,
      cacheGeneration: () => this.#cacheGeneration,
      ensureSceneCache: (value) => this.#ensureSceneCache(value),
      refreshAuthorization: () => this.#refreshAuthorization(),
      publishInBackground: () => this.#publishInBackground(),
      sendStateSync: (socket, admission) => this.#sendStateSync(socket, admission),
      queuePostCommit: () => this.#queuePostCommit(),
      refreshIdleRelease: (leaving) => this.#refreshIdleRelease(leaving),
      openSockets: (except) => this.#openSockets(except),
      dropFeeds: (socket) => {
        this.#sheetFeed.drop(socket)
        this.#encounterFeed.drop(socket)
        this.#summaryFeed.drop(socket)
      },
      dropSocketState: (socket) => {
        this.#budgets.delete(socket)
        this.#previewStreams.delete(socket)
      }
    })
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
      return this.#admissions.challenge(socket)
    this.#admissions.restore(socket, {
      deadline: value.admissionDeadline,
      generation: 0,
      membershipEpoch: value.membershipEpoch,
      role: value.role,
      userId: value.userId
    })
    if (value.feeds?.characterSheet) this.#sheetFeed.restore(socket, value.feeds.characterSheet)
    if (value.feeds?.encounterSession)
      this.#encounterFeed.restore(socket, value.feeds.encounterSession)
    if (value.feeds?.campaignSummary) this.#summaryFeed.restore(socket)
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
        if (this.ctx.getWebSockets().some((socket) => this.#admissions.liveAdmission(socket)))
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
      this.#admissions.closeSocket(socket, 'Invalid live-session message.')
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
      this.#admissions.closeSocket(socket, `Too many live-session ${kind} messages.`)
      return
    }
    if (!parsed.success) {
      this.#admissions.challenge(socket)
      return
    }
    if (parsed.data.type === 'AUTHENTICATE') {
      await this.#admissions.authenticate(socket, parsed.data.accessToken)
      return
    }
    const admission = this.#admissions.liveAdmission(socket)

    if (!admission) {
      this.#admissions.challenge(socket)
      return
    }
    this.#renewAuthorizationIfDue()
    if (parsed.data.type === 'RESUME') {
      const value = attachment(socket)
      if (!value) return this.#admissions.challenge(socket)
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
        .then(() => stageSceneFog(this.#host, socket, admission, message))
        .catch((error: unknown) => this.#rejectRoomFailure(socket, commandId, error))
      this.#commandChain = next
      await next
      return
    }
    try {
      this.#broadcastTransient(socket, admission, parsed.data.envelope)
    } catch {
      this.#cache = null
      this.#admissions.challenge(socket, admission.generation)
    }
  }

  async webSocketClose(socket: WebSocket): Promise<void> {
    this.#admissions.forgetSocket(socket)
    await this.#refreshIdleRelease(socket)
  }

  async webSocketError(socket: WebSocket): Promise<void> {
    this.#admissions.forgetSocket(socket)
    await this.#refreshIdleRelease(socket)
  }

  /**
   * Closes sockets that have not authenticated within the admission window, and drains and releases
   * authority once the room has had no admitted socket for the idle window.
   */
  async alarm(): Promise<void> {
    this.#meter.request('ALARM')
    this.#admissions.reauthenticateExpiring()
    if (await this.#authority.recoverIfNeeded()) {
      await this.#scheduleAlarm()
      return
    }
    const now = Date.now()
    for (const socket of this.#openSockets()) {
      const value = attachment(socket)
      if (!value || value.membershipEpoch !== null || this.#admissions.has(socket)) continue
      if (value.acceptedAt + ROOM_LIMITS.authenticationTimeoutMs <= now)
        this.#admissions.closeSocket(socket, 'Live-session authentication timed out.')
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
      const expiresAt = this.#admissions.expiry(socket)
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
    if (current?.status === 'ACTIVE') await reconcileActorDepartures(this.#host, current)
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
      const origin = this.ctx
        .getWebSockets()
        .find((socket) => this.#admissions.liveAdmission(socket))
      const value = origin ? attachment(origin) : null
      if (!value) return
      try {
        const authorization = await this.#refreshAuthorization()
        if (this.#aggregateNeedsReload) await reloadRoomAggregate(this.#host, value)
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
   * `scene` as vision, fog and sense projection read it: a Character's grantees control its linked
   * tokens too (D162). Never stored.
   */
  #controlledScene(scene: CampaignSceneStateDto, authorityEpoch: string): CampaignSceneStateDto {
    return withCharacterControllers(
      scene,
      this.#authorization.current(authorityEpoch)?.campaign.assignments ?? []
    )
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
            this.#controlledScene(scene, authorityEpoch),
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
      this.#admissions.liveAdmission(socket)?.generation !== admission.generation
    )
      return this.#admissions.challenge(socket, admission.generation)
    send(socket, {
      authorityEpoch: current.authorityEpoch,
      sequence: current.sequence,
      state: projectNativeLiveSessionState(
        {
          scene: this.#cache?.scene
            ? this.#controlledScene(this.#cache.scene, value.authorityEpoch)
            : null
        },
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
    if (this.#admissions.liveAdmission(socket)?.generation !== admission.generation) return
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
    if (this.#admissions.liveAdmission(socket)?.generation !== admission.generation) return
    if (!admitsRoomMember(authorization, admission))
      return this.#admissions.closeSocket(socket, 'Campaign access ended.')
    if (this.#admissions.liveAdmission(socket)?.generation !== admission.generation) return
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
      return executeEncounterCommand(this.#host, socket, admission, value, message.command.command)
    if (message.command.scope === 'ENCOUNTER_BINDING')
      return executeEncounterBinding(this.#host, socket, admission, value, message.command.command)
    if (message.command.scope === 'CHARACTER_SHEET')
      return executeCharacterSheetCommand(this.#host, socket, admission, value, message.command)
    if (message.command.scope === 'CAMPAIGN_CHAT')
      return executeCampaignChatCommand(this.#host, socket, admission, value, message.command)
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
        await reloadRoomAggregate(this.#host, value)
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
              this.#controlledScene(scene, value.authorityEpoch),
              viewer(admission),
              this.#boundTokenControl(scene, admission, value.authorityEpoch)
            )
          }
        : undefined
    if (!this.#buckets.admits(accountBucket('SCENE', value, admission))) {
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
        await commitRoomSceneEdit(
          this.#host,
          socket,
          admission,
          value,
          command,
          fingerprint,
          (base) => publishRoomSceneInline({ ...base, actor: admission, command })
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
        await commitRoomSceneEdit(
          this.#host,
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
        await commitRoomSceneEdit(
          this.#host,
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
        await commitRoomGeometry(this.#host, socket, admission, value, command, fingerprint)
      } catch (error) {
        this.#rejectSceneCommand(socket, commandId, error, correction())
      }
      return
    }
    const plan = planLiveSceneCommand({
      actor: admission,
      assignments: authorization.campaign.assignments,
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
        await commitRoomGeometry(this.#host, socket, admission, value, command, fingerprint)
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
          this.#admissions.liveAdmission(socket)?.generation !== admission.generation ||
          !authorization ||
          !admitsRoomMember(authorization, admission)
        )
          throw new RoomAdmissionExpiredError()
        if (entry.sequence !== current.sequence + 1)
          throw new Error('Room command sequence does not match its authority.')
        this.#buckets.charge(accountBucket('SCENE', value, admission))
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
    const authorization = await restoreLocalPlayAuthorization(
      this.#host,
      await this.#authorization.refresh(current.authorityEpoch)
    )
    for (const socket of this.ctx.getWebSockets()) {
      const value = attachment(socket)
      const member =
        this.#admissions.get(socket) ??
        (value?.membershipEpoch ? { ...value, membershipEpoch: value.membershipEpoch } : null)
      if (member && !admitsRoomMember(authorization, member))
        this.#admissions.closeSocket(socket, 'Campaign access ended.')
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
        await reconcileActorDepartures(this.#host, current)
      } catch (error) {
        console.error('Live Session actor reconcile failed.', error)
      }
      try {
        // The departures may have journaled, so the sweep reads the head afresh.
        const head = this.#journal.readCurrent()
        if (head?.status === 'ACTIVE') await endBrokenRelationships(this.#host, head)
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
        await loadRoomAggregate(this.#host, this.#cache?.scene?.id ?? null)
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

  /** The cache a command or broadcast may use: current, or reloaded first by one read. */
  async #authorizationBoundary(
    value: Pick<SocketAttachment, 'authorityEpoch'>
  ): Promise<LiveSessionRoomAuthorization> {
    return this.#authorization.current(value.authorityEpoch) ?? this.#refreshAuthorization()
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
      const admission = this.#admissions.liveAdmission(socket)
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
   * movement decision settles, `commitRoomGeometry` stores it ahead of the Encounter result.
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
          this.#controlledScene(before, epoch),
          this.#controlledScene(after, epoch),
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
      const admission = this.#admissions.liveAdmission(socket)
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
    if (!originAttachment) return this.#admissions.challenge(origin)
    // Broadcasts are refused while the authorization cache is stale or past its lease.
    const authorization = this.#authorization.current(originAttachment.authorityEpoch)
    if (!authorization) return this.#refreshAuthorizationInBackground()
    if (!admitsRoomMember(authorization, originAdmission)) return
    const candidates = this.ctx.getWebSockets().flatMap((socket) => {
      const candidate = this.#admissions.liveAdmission(socket)
      if (!candidate) return (this.#admissions.challenge(socket), [])
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
    await loadRoomAggregate(this.#host, header.id)
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

  #movementIndex(scene: CampaignSceneStateDto): SceneBarrierIndex {
    const cached = this.#movementIndexes.get(scene.id)
    if (cached?.barriers === scene.barriers) return cached.index
    const index = new SceneBarrierIndex(scene.barriers)
    this.#movementIndexes.set(scene.id, { barriers: scene.barriers, index })
    return index
  }

  async #presentScene(input: LiveSessionPresentationControlInput) {
    await this.#authority.activating()
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
      for (const socket of this.ctx.getWebSockets()) this.#admissions.challenge(socket)
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
    this.#authority.reset()
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
      this.#admissions.invalidate(socket)
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
