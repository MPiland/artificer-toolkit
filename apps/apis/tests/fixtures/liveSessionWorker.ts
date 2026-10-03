import { beforeEach, expect, vi } from 'vitest'
import { CharacterSheetCommandError } from '@artificer-toolkit/rules-runtime/character/sheetCommandError'
import {
  encounterCommandResultDtoSchema,
  encounterExecuteInputSchema,
  type EncounterCommandInputDto,
  type EncounterCommandResultDto,
  type ResolveRuleOccurrenceInputDto,
  type VoidRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { liveSessionRoomAuthorizationSchema } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import type { SceneGeometryCommandResult } from '@artificer-toolkit/schema/api/sceneGeometry'
import {
  encounterActorTokenBindingCommandInputDtoSchema,
  type EncounterActorTokenBindingCommandInputDto,
  type SceneTokenMovementCommandInputDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { EncounterDomainRejection } from '@artificer-toolkit/encounter-persistence/domainRejections'
import type { z } from 'zod'
import type { TestConvex } from 'convex-test'
import { ConvexError } from 'convex/values'
import {
  getFunctionName,
  type FunctionReference,
  type FunctionReturnType,
  type OptionalRestArgs
} from 'convex/server'
import { executeEncounterCommand, type DevelopmentClient } from '../developmentClient'
import { api, internal } from '../../convex/_generated/api'
import { createConvexEncounterStoreReader } from '../../convex/lib/convexEncounterStore'
import type { MutationCtx } from '../../convex/_generated/server'
import * as rollRandom from '../../convex/lib/rollRandom'
import type schema from '../../convex/schema'
import {
  parseGeometrySave,
  readSpatialPreparation
} from '@artificer-toolkit/encounter-persistence/sceneGeometryDocuments'
import { readRoomAuthorization } from '../../convex/liveSessions/roomAuthorization'
import { releaseCharacterHolds } from '../../convex/liveSessions/characterHolds'
import { installContentSnapshots } from './roomContentSnapshots'
import {
  callLiveSessionRoute,
  LiveSessionDomainRejectionError,
  LiveSessionRouteError
} from '../../../session-worker/src/liveSessionRoutes'
import {
  encounterCommandRefusal,
  sceneNotPresentedRejection,
  type LiveEncounterActor
} from '../../../session-worker/src/nativeRoomEncounterCommand'
import {
  executeRoomEncounterCommand as executeRoomCommand,
  replayRoomEncounterCommand,
  roomEncounterCommandFingerprint
} from '../../../session-worker/src/roomEncounterCommands'
import {
  readRoomEncounterResponseRoute,
  roomOwnsEncounterVoid
} from '../../../session-worker/src/roomEncounterResponseRouting'
import { RoomEncounterStore } from '../../../session-worker/src/roomEncounterStore'
import { RoomInputs } from '../../../session-worker/src/roomInputs'
import { RoomCheckpoints } from '../../../session-worker/src/roomCheckpoints'
import { loadRoomContentSnapshots } from '../../../session-worker/src/roomContentSnapshots'
import { createNodeSqliteRoomStorage } from '../../../session-worker/src/testing/nodeSqliteRoomStorage'
import { readNativeEncounterOccurrenceOwner } from '@artificer-toolkit/encounter-persistence/occurrenceOwner'
import { voidDeclineCommandId } from '@artificer-toolkit/encounter-persistence/occurrenceVoid'
import type {
  ExternalSceneContext,
  ExternalSceneCommand
} from '../../../session-worker/src/nativeExternalSceneCommit'
import { executeRoomSceneGeometry } from '../../../session-worker/src/roomSceneGeometryCommand'
import { composeRoomSceneVision } from '../../../session-worker/src/roomSceneVision'
import { readRoomSceneState } from '../../../session-worker/src/roomSceneRead'
import {
  createNativeLiveRulesRuntime,
  secureRandomInt
} from '../../../session-worker/src/nativeRulesRuntime'

export function workerEnvironment(secret: string) {
  return { CONVEX_SITE_URL: 'https://convex.example.test', LIVE_SESSION_WORKER_SECRET: secret }
}

type LiveSessionRoute = (pathname: string, init?: RequestInit) => Promise<Response> | Response

function liveSessionFetch(route: LiveSessionRoute) {
  return (url: string | URL | Request, init?: RequestInit) =>
    route(new URL(url instanceof Request ? url.url : url.toString()).pathname, init)
}

/** Routes the Worker's Convex site requests by pathname, typically into a convex-test caller. */
export function stubLiveSessionFetch(route: LiveSessionRoute) {
  vi.stubGlobal('fetch', vi.fn(liveSessionFetch(route)))
}

const ROOM_WORKER_SECRET = 'fixture-room-worker-secret-at-least-32-bytes-long'

/**
 * Runs Worker room code with its Convex requests served by `caller`, a member's convex-test
 * identity, and the live rules runtime. The test's own fetch and Worker secret are restored after.
 */
export async function withRoomConvex<T>(
  caller: { fetch(pathname: string, init?: RequestInit): Promise<Response> },
  run: (room: {
    environment: ReturnType<typeof workerEnvironment>
    accessToken: string
    runtime: Awaited<ReturnType<typeof createNativeLiveRulesRuntime>>
  }) => Promise<T>
): Promise<T> {
  const fetch = globalThis.fetch
  const secret = process.env.LIVE_SESSION_WORKER_SECRET
  const route = liveSessionFetch((pathname, init) => caller.fetch(pathname, init))
  globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => route(url, init)
  process.env.LIVE_SESSION_WORKER_SECRET = ROOM_WORKER_SECRET
  try {
    return await run({
      environment: workerEnvironment(ROOM_WORKER_SECRET),
      accessToken: 'fixture-access-token',
      runtime: await createNativeLiveRulesRuntime(process.env.RULES_CONTINUATION_SECRET ?? '')
    })
  } finally {
    globalThis.fetch = fetch
    if (secret === undefined) delete process.env.LIVE_SESSION_WORKER_SECRET
    else process.env.LIVE_SESSION_WORKER_SECRET = secret
  }
}

/**
 * The room's Scene cache for `encounterId`: the room's capture for the presentation, then the
 * Scene from its own hydrated rows as the room builds it; null when the presented Scene is not bound to that Encounter (or, for a null
 * `encounterId`, is bound to any), so the room does not own it.
 */
async function roomSceneContext(
  room: OpenRoom,
  session: { environment: ReturnType<typeof workerEnvironment>; accessToken: string },
  actor: LiveEncounterActor,
  encounterId: string | null
): Promise<ExternalSceneContext | null> {
  const capture = await callLiveSessionRoute(session.environment, session.accessToken, 'capture', {
    campaignId: actor.campaignId,
    expectedUserId: actor.expectedUserId,
    expectedRole: actor.expectedRole,
    mode: 'FULL',
    observedCharacterRevisions: [],
    recipientUserIds: []
  })
  if (!capture.presentation || capture.sceneEncounterId !== (encounterId?.toLowerCase() ?? null))
    return null
  const header = capture.sceneHeader
  if (!header) return null
  const hydrated = await room.store.transact(async (transaction) => {
    const { scene, baseOrdinals } = await readRoomSceneState(transaction, header.id)
    const composition = await composeRoomSceneVision({
      store: room.store,
      transaction,
      inputs: room.inputs,
      authorization: room.authorization,
      campaignId: actor.campaignId,
      epoch: actor.authorityEpoch,
      scene,
      encounterIds: capture.sceneEncounterId ? [capture.sceneEncounterId] : []
    })
    return { baseOrdinals, ...composition }
  })
  return {
    scene: hydrated.scene,
    baseOrdinals: hydrated.baseOrdinals,
    characterRevisions: hydrated.characterRevisions,
    presentation: { expectedPresentationVersion: capture.presentation.version }
  }
}

/** A non-domain room refusal, redacted as the room reports it to the member; `cause` keeps the error. */
export class RoomCommandRefusal extends Error {
  readonly code: ReturnType<typeof encounterCommandRefusal>['code']

  constructor(cause: unknown, refusal = encounterCommandRefusal(cause)) {
    super(refusal.message, { cause })
    this.name = 'RoomCommandRefusal'
    this.code = refusal.code
  }
}

/** Asserts the room redacted a command's failure, by the reason its cause keeps for the server log. */
export async function expectRedactedRoomRefusal(
  command: Promise<unknown>,
  reason: string | RegExp,
  code: RoomCommandRefusal['code'] = 'UNAVAILABLE'
) {
  const error = await command.then(
    () => {
      throw new Error('Expected the room to refuse the command.')
    },
    (failure: unknown) => failure
  )
  // Anything else (a domain rejection or a harness failure) is rethrown whole for the test report.
  if (!(error instanceof RoomCommandRefusal)) throw error
  expect({
    code: error.code,
    reason: error.cause instanceof Error ? error.cause.message : error.cause
  }).toEqual({
    code,
    reason:
      typeof reason === 'string' ? expect.stringContaining(reason) : expect.stringMatching(reason)
  })
}

/**
 * The room's durable command journal, keyed as the room keys it (its Campaign and the command ID):
 * the submitter, the command's fingerprint and its committed Encounter result, or null for a
 * movement decision, whose receipt is the Scene's. Each test opens new rooms.
 */
const roomJournal = new Map<
  string,
  { userId: string; fingerprint: string; resultJson: string | null }
>()
beforeEach(() => roomJournal.clear())

/**
 * A release ends the room's epoch with its durable journal, so a retry after it replays only from
 * the Encounter receipts the next room hydrates from Convex.
 */
export function discardRoomJournal() {
  roomJournal.clear()
}

/** A room refusal whose code and message the room sends as they are. */
function roomRefusal(code: RoomCommandRefusal['code'], message: string) {
  return new RoomCommandRefusal(new Error(message), { code, message })
}

/**
 * A room store for one member's work over node SQLite, as the Session room opens it: hydrated
 * (`hydrate`) from the Convex room inputs at the authority's persisted checkpoint with its
 * presented Scene, and checkpointed (`flush`) through the real checkpoint mutation. The Campaign
 * needs an active live authority at `actor.authorityEpoch`.
 */
async function openRoom(
  caller: MemberCaller,
  actor: LiveEncounterActor,
  encounterId: string | null
) {
  const { campaignId, authorityEpoch: epoch, expectedUserId: userId } = actor
  const read = await caller.run(async (ctx) => {
    const authority = await ctx.db
      .query('campaignLiveAuthorities')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
      .unique()
    if (!authority || authority.epoch !== epoch)
      throw new Error('Live authority fixture is missing.')
    // As the room does, hydrate the presented Scene, if any.
    const presentation = await ctx.db
      .query('campaignScenePresentations')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
      .unique()
    return {
      checkpoint: {
        epoch,
        sequence: authority.persistedSequence,
        checksum: authority.persistedStateChecksum
      },
      sceneId: presentation?.sceneId ?? null,
      // A test transaction cannot return the authorization's undefined members.
      authorizationJson: JSON.stringify(
        await readRoomAuthorization(ctx, { campaignId, epoch, known: null })
      )
    }
  })
  const authorization = liveSessionRoomAuthorizationSchema.parse(JSON.parse(read.authorizationJson))
  if (!authorization.campaign.members.some((member) => member.userId === userId))
    throw new RoomCommandRefusal(new LiveSessionRouteError(403))
  const contentSnapshots = await installContentSnapshots(caller, campaignId)
  const runtime = await createNativeLiveRulesRuntime(process.env.RULES_CONTINUATION_SECRET ?? '')
  const { storage, database } = createNodeSqliteRoomStorage()
  const store = new RoomEncounterStore(storage)
  const inputs = new RoomInputs(
    store,
    (inputEpoch, scope) =>
      caller.query(internal.liveSessions.roomInputs.read, { campaignId, epoch: inputEpoch, scope }),
    (manifest) => loadRoomContentSnapshots(contentSnapshots, manifest, campaignId)
  )
  return {
    store,
    inputs,
    authorization,
    runtime,
    sceneId: read.sceneId,
    hydrate: () =>
      inputs.hydrate({ epoch, encounterId, sceneId: read.sceneId, checkpoint: read.checkpoint }),
    flush: () =>
      new RoomCheckpoints(store, storage, (checkpoint) =>
        caller.mutation(internal.liveSessions.checkpoint.publish, checkpoint)
      ).flush({ campaignId, epoch, knownAuthorization: null }),
    close: () => database.close()
  }
}

type OpenRoom = Awaited<ReturnType<typeof openRoom>>

/** Room work, which reaches Convex only through its room inputs and checkpoints, never over HTTP. */
async function withoutHttp<T>(work: () => Promise<T>): Promise<T> {
  const fetch = globalThis.fetch
  globalThis.fetch = async () => {
    throw new Error('The room-native path attempted an HTTP request.')
  }
  try {
    return await work()
  } finally {
    globalThis.fetch = fetch
  }
}

/**
 * Commits an Encounter-bound move or movement decision in a hydrated room with its presented Scene
 * (D27), as the Session room does: the Scene context from the room's capture, then geometry, fog,
 * rules and Encounter writes in one room transaction. Off the presented Scene it is refused (D42).
 * Returns the Scene and Encounter results with the move's save and its planned outcome.
 */
async function commitRoomMovement(
  room: OpenRoom,
  input: {
    caller: MemberCaller
    actor: LiveEncounterActor
    encounterId: string
    command: ExternalSceneCommand
    random: (maximum: number) => number
  }
) {
  const { command } = input
  const { saves, ...result } = await commitRoomScene(room, input)
  // A GM void moves on as its decline, which the room saves under the decline's command ID.
  const commandId =
    command.type === 'VOID_RULE_OCCURRENCE'
      ? voidDeclineCommandId(command.commandId.toLowerCase())
      : command.commandId.toLowerCase()
  const save = saves.find((entry) => entry.commandId === commandId)
  const preparation = save ? readSpatialPreparation(save) : null
  if (!save || !preparation) throw new Error('The room published no planned movement save.')
  return { ...result, saveId: save.id, outcome: preparation.outcome }
}

/**
 * Commits a Scene command on the presented Scene in a hydrated room as the Session room does:
 * the Scene context from the room's capture, then geometry, fog and any rules in one room
 * transaction. A null `encounterId` is a Scene bound to no Encounter; a Scene not bound as
 * requested is refused (D42). Returns the result with the geometry saves the transaction wrote.
 */
async function commitRoomScene(
  room: OpenRoom,
  input: {
    caller: MemberCaller
    actor: LiveEncounterActor
    encounterId: string | null
    command: ExternalSceneCommand
    random: (maximum: number) => number
  }
) {
  const { caller, actor, command } = input
  // The room captures its presented Scene from Convex before it plans against it.
  const context = await withRoomConvex(caller, (session) =>
    roomSceneContext(room, session, actor, input.encounterId)
  )
  if (!context) throw sceneNotPresentedRejection()
  return room.store.transact(
    async (transaction) => {
      const result = await executeRoomSceneGeometry({
        store: room.store,
        transaction,
        inputs: room.inputs,
        authorization: room.authorization,
        campaignId: actor.campaignId,
        epoch: actor.authorityEpoch,
        userId: actor.expectedUserId,
        command,
        context,
        runtime: room.runtime,
        random: input.random
      })
      const saves = transaction
        .records('SCENE_CHECKPOINT_ROW')
        .filter((record) => record.key.startsWith('["sceneGeometrySaves",'))
        .map((record) => parseGeometrySave(JSON.parse(record.json)))
        .filter((entry) => entry.sceneId === context.scene.id)
      return { ...result, saves }
    },
    // As the room does, every command commits one journal entry with its receipt.
    () => undefined
  )
}

/**
 * Sends one Encounter command to the room as a member, the way the Session room commits it (D78):
 * a fresh room (`openRoom`), the room-native executor in one room transaction with no HTTP (a
 * movement decision with the presented Scene, `commitRoomMovement`), then the room's checkpoint
 * published before this returns. A domain rejection surfaces as the ConvexError data the browser
 * receives; any other refusal as a redacted `RoomCommandRefusal`.
 */
export async function executeRoomEncounterCommand(input: {
  caller: MemberCaller
  actor: LiveEncounterActor
  command: EncounterCommandInputDto | EncounterActorTokenBindingCommandInputDto
  random?: (maximum: number) => number
}): Promise<EncounterCommandResultDto> {
  const { caller, actor, command } = input
  const random = input.random ?? secureRandomInt
  const { campaignId, authorityEpoch: epoch, expectedUserId: userId } = actor
  const encounterId = command.encounterId.toLowerCase()
  const room = await openRoom(caller, actor, encounterId)
  try {
    const { store, inputs, authorization } = room
    const fingerprint = roomEncounterCommandFingerprint(command)
    const journalKey = `${campaignId}:${command.commandId}`
    // As the room does, any failure from hydration to commit is refused to the member.
    const committed = await withoutHttp(async () => {
      await room.hydrate()
      let movement: ResolveRuleOccurrenceInputDto | VoidRuleOccurrenceInputDto | null = null
      if (command.type === 'RESOLVE_RULE_OCCURRENCE' || command.type === 'VOID_RULE_OCCURRENCE') {
        const route = await readRoomEncounterResponseRoute(store, command)
        const native =
          command.type === 'VOID_RULE_OCCURRENCE'
            ? await roomOwnsEncounterVoid(store, command)
            : route !== null && route !== 'MOVEMENT'
        if (route === 'MOVEMENT' && !native) movement = command
      }
      // As the room does, a reused command ID is looked up in the journal before execution.
      const prior = roomJournal.get(journalKey)
      if (prior) {
        if (prior.userId !== userId || prior.fingerprint !== fingerprint)
          throw roomRefusal(
            'INVALID_COMMAND',
            'The command ID was already used for different input.'
          )
        if (prior.resultJson === null)
          throw roomRefusal('STALE_STATE', 'This decision was already settled.')
        return {
          kind: 'REPLAY' as const,
          result: await replayRoomEncounterCommand({
            store,
            inputs,
            authorization,
            userId,
            result: encounterCommandResultDtoSchema.parse(JSON.parse(prior.resultJson))
          })
        }
      }
      if (movement) {
        const { encounter } = await commitRoomMovement(room, {
          caller,
          actor,
          encounterId,
          command: movement,
          random
        })
        if (!encounter) throw new Error('A movement decision commit returned no Encounter result.')
        // A movement decision's receipt is the Scene's: its retry is refused as stale.
        roomJournal.set(journalKey, { userId, fingerprint, resultJson: null })
        return { kind: 'COMMITTED' as const, result: encounter }
      }
      const transacted = await store.transact(
        (transaction) =>
          executeRoomCommand({
            store,
            transaction,
            inputs,
            authorization,
            campaignId,
            epoch,
            userId,
            recipientUserIds: [],
            command,
            presentedSceneId: room.sceneId,
            random,
            turnExecution: { runtime: room.runtime }
          }),
        // As the room does, every command commits one journal entry with its receipt.
        () => undefined
      )
      const own = transacted.recipients.get(userId)
      if (!own) throw new Error('The room produced no result for its submitter.')
      roomJournal.set(journalKey, { userId, fingerprint, resultJson: JSON.stringify(own) })
      return { kind: 'COMMITTED' as const, result: own }
    }).catch((error: unknown) => {
      // As the room does, a Sheet refusal reaches the member with its own message.
      if (error instanceof CharacterSheetCommandError || error instanceof RoomCommandRefusal)
        throw error
      throw domainRejection(error) ?? new RoomCommandRefusal(error)
    })
    if (committed.kind === 'REPLAY') return committed.result
    await withoutHttp(room.flush)
    return committed.result
  } finally {
    room.close()
  }
}

type MemberCaller = ReturnType<TestConvex<typeof schema>['withIdentity']>

/**
 * Runs room work as the caller's Campaign member on `encounterId` (see `enterRoom`). A domain
 * rejection surfaces as the ConvexError data the browser receives; any other refusal stays
 * redacted, as the room reports it.
 */
function asRoomMember<T>(
  caller: MemberCaller,
  encounterId: string,
  work: (actor: LiveEncounterActor) => Promise<T>
): Promise<T> {
  return queueRoomWork(async () => {
    const member = await enterRoom(caller, { encounterId })
    try {
      return await work(member.actor)
    } catch (error) {
      throw domainRejection(error) ?? error
    } finally {
      await member.leave()
    }
  })
}

/** The room runs one command at a time, so concurrent test commands queue as they would there. */
function queueRoomWork<T>(work: () => Promise<T>): Promise<T> {
  const turn = roomQueue.then(work)
  roomQueue = turn.catch(() => undefined)
  return turn
}

let roomQueue: Promise<unknown> = Promise.resolve()

/**
 * The caller as a room member on `encounterId`'s Campaign. A Campaign without a live authority
 * gets an active one until `leave`, so the rest of a test keeps its non-live Campaign.
 */
async function enterRoom(
  caller: MemberCaller,
  target: { encounterId: string } | { campaignId: string }
) {
  const identity = await caller.query(api.account.identity, {})
  if (!identity) throw new Error('Unauthenticated: the Session room admits only signed-in members.')
  const { actor, createdAuthority } = await caller.run(async (ctx) => {
    let campaignId: string
    if ('campaignId' in target) campaignId = target.campaignId
    else {
      const run = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', target.encounterId.toLowerCase()))
        .unique()
      if (!run) throw new Error('Encounter is unavailable.')
      campaignId = run.campaignId
    }
    const membership = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', campaignId).eq('userId', identity.userId)
      )
      .unique()
    const authority = await ctx.db
      .query('campaignLiveAuthorities')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
      .unique()
    const authorityEpoch = authority?.epoch ?? crypto.randomUUID()
    return {
      actor: {
        campaignId,
        authorityEpoch,
        expectedUserId: identity.userId,
        // A non-member is sent as a player so the room's own admission refuses them.
        expectedRole: membership?.role === 'OWNER' ? ('OWNER' as const) : ('PLAYER' as const)
      },
      createdAuthority: authority
        ? null
        : await insertActiveLiveAuthority(ctx, {
            campaignId,
            epoch: authorityEpoch,
            createdAt: new Date().toISOString()
          })
    }
  })
  return {
    actor,
    // The temporary authority ends as a release does, without its open-Run reconcile.
    leave: async () => {
      if (createdAuthority)
        await caller.run(async (ctx) => {
          await releaseCharacterHolds(ctx, actor.campaignId, actor.authorityEpoch)
          await ctx.db.delete(createdAuthority)
        })
    }
  }
}

/** A domain rejection surfaces as the ConvexError data the browser receives. */
function domainRejection(error: unknown) {
  if (error instanceof EncounterDomainRejection) return new ConvexError(error.data)
  if (error instanceof LiveSessionDomainRejectionError) return new ConvexError(error.rejection)
  return null
}

/** The room's dice: `nextRollInt` unless a test gives its own, so a test's spy on it drives them. */
function roomRandom(random?: (maximum: number) => number) {
  return random ?? ((maximum: number) => rollRandom.nextRollInt(maximum))
}

/**
 * Sends an Encounter command through the room as the caller's Campaign member, the way a browser
 * does (see `asRoomMember` and `executeRoomEncounterCommand`): committed room-natively and
 * checkpointed to Convex before this returns.
 */
export async function executeInRoom(
  caller: MemberCaller,
  input: z.input<typeof encounterExecuteInputSchema>,
  random?: (maximum: number) => number
): Promise<EncounterCommandResultDto> {
  const { command } = encounterExecuteInputSchema.parse(input)
  return asRoomMember(caller, command.encounterId, (actor) =>
    executeRoomEncounterCommand({ caller, actor, command, random: roomRandom(random) })
  )
}

/**
 * Retries a settled command as a lost acknowledgement's retry reaches the room: a fresh room
 * hydrated from the Encounter documents must return the stored result without rolling.
 */
export async function replayInRoom(
  caller: MemberCaller,
  input: z.input<typeof encounterExecuteInputSchema>
): Promise<EncounterCommandResultDto> {
  const { command } = encounterExecuteInputSchema.parse(input)
  const replay = () =>
    executeInRoom(caller, { command }, () => {
      throw new Error('A replay must not roll.')
    })
  if (command.type !== 'RESOLVE_RULE_OCCURRENCE') return replay()
  const owner = await caller.run(async (ctx) => {
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', command.encounterId.toLowerCase()))
      .unique()
    if (!run) throw new Error('Encounter is unavailable.')
    return readNativeEncounterOccurrenceOwner(
      { db: createConvexEncounterStoreReader(ctx) },
      run,
      command.occurrenceId.toLowerCase()
    )
  })
  // A movement decision commits with the room's Scene, which refuses its retry as stale.
  if (owner === 'MOVEMENT') throw new Error('A settled movement decision has no replay.')
  return replay()
}

/** The Encounter bound to a Scene, for room work on one of its moves. */
async function sceneEncounterId(caller: Pick<MemberCaller, 'run'>, sceneId: string) {
  const binding = await caller.run((ctx) =>
    ctx.db
      .query('encounterSceneBindings')
      .withIndex('by_sceneId', (q) => q.eq('sceneId', sceneId.toLowerCase()))
      .first()
  )
  if (!binding) throw new Error('Expected an Encounter-bound Scene.')
  return binding.encounterId
}

/**
 * Commits a move or movement decision in the room as `caller` (`commitRoomMovement`) and returns
 * its save and planned outcome with `publish`, which checkpoints the room to Convex, as the room
 * later does; until then Convex has not seen the commit, so a test can inspect it in between. Dice
 * come from `nextRollInt`, so a test's spy on it drives them.
 */
async function planInRoom(
  caller: MemberCaller,
  encounterId: string,
  command: ExternalSceneCommand
) {
  const planned = await queueRoomWork(async () => {
    const member = await enterRoom(caller, { encounterId })
    try {
      const room = await openRoom(caller, member.actor, encounterId)
      try {
        const committed = await withoutHttp(async () => {
          await room.hydrate()
          return commitRoomMovement(room, {
            caller,
            actor: member.actor,
            encounterId,
            command,
            random: (maximum) => rollRandom.nextRollInt(maximum)
          })
        })
        return { member, room, committed }
      } catch (error) {
        room.close()
        throw error
      }
    } catch (error) {
      await member.leave()
      throw domainRejection(error) ?? error
    }
  })
  const { member, room, committed } = planned
  return {
    saveId: committed.saveId,
    outcome: committed.outcome,
    publish: (): Promise<SceneGeometryCommandResult> =>
      queueRoomWork(async () => {
        try {
          await withoutHttp(room.flush)
          return committed.scene
        } finally {
          room.close()
          await member.leave()
        }
      })
  }
}

/** Plans a movement decision's answer or GM void in the room (`planInRoom`). */
export function planMovementDecisionInRoom(
  caller: MemberCaller,
  command: ResolveRuleOccurrenceInputDto | VoidRuleOccurrenceInputDto
) {
  return planInRoom(caller, command.encounterId, command)
}

/**
 * Plans a new Encounter-bound move in the room (`planInRoom`), as a tabletop drag reaches it: the
 * room stages it with the presented Scene's fence, plans its rules and commits it.
 */
export async function planMovementInRoom(
  caller: MemberCaller,
  command: SceneTokenMovementCommandInputDto
) {
  return planInRoom(caller, await sceneEncounterId(caller, command.sceneId), command)
}

/**
 * Commits a move or door change on a token of the Campaign's presented Scene bound to no Encounter,
 * in the room as `caller` (`commitRoomScene`), checkpointed to Convex before this returns. The
 * room refuses what it refuses, as a non-controller's move or a player's locked door.
 */
export function commitSceneInRoom(
  caller: MemberCaller,
  campaignId: string,
  command: ExternalSceneCommand
): Promise<SceneGeometryCommandResult> {
  return queueRoomWork(async () => {
    const member = await enterRoom(caller, { campaignId })
    try {
      const room = await openRoom(caller, member.actor, null)
      try {
        const committed = await withoutHttp(async () => {
          await room.hydrate()
          return commitRoomScene(room, {
            caller,
            actor: member.actor,
            encounterId: null,
            command,
            random: (maximum) => rollRandom.nextRollInt(maximum)
          })
        })
        await withoutHttp(room.flush)
        return committed.scene
      } finally {
        room.close()
      }
    } catch (error) {
      throw domainRejection(error) ?? error
    } finally {
      await member.leave()
    }
  })
}

/**
 * Binds or unbinds an Encounter actor's Scene token through the room as the GM does on the
 * presented Scene (D78), checkpointed to Convex before this returns.
 */
export function bindActorTokenInRoom(
  caller: MemberCaller,
  input: z.input<typeof encounterActorTokenBindingCommandInputDtoSchema>
): Promise<EncounterCommandResultDto> {
  const command = encounterActorTokenBindingCommandInputDtoSchema.parse(input)
  return asRoomMember(caller, command.encounterId, (actor) =>
    executeRoomEncounterCommand({ caller, actor, command })
  )
}

/**
 * A development proof client over a convex-test caller: Encounter commands go through the room and
 * fail as DevelopmentHttpClient reports the room's refusals; everything else runs in the caller's
 * transaction.
 */
export function inProcessDevelopmentClient(caller: MemberCaller): DevelopmentClient {
  return {
    query: (reference, ...args) => caller.run((ctx) => ctx.runQuery(reference, ...args)),
    mutation: <Reference extends FunctionReference<'mutation'>>(
      reference: Reference,
      ...args: OptionalRestArgs<Reference>
    ): Promise<FunctionReturnType<Reference>> =>
      getFunctionName(reference) === getFunctionName(executeEncounterCommand)
        ? (executeInRoom(caller, encounterExecuteInputSchema.parse(args[0])).catch(
            (error: unknown) => {
              if (!(error instanceof RoomCommandRefusal)) throw error
              throw new Error(`${error.code}: ${error.message}`, { cause: error.cause })
            }
          ) as Promise<FunctionReturnType<Reference>>)
        : caller.run((ctx) => ctx.runMutation(reference, ...args))
  }
}

export function insertActiveLiveAuthority(
  ctx: MutationCtx,
  { campaignId, epoch, createdAt }: { campaignId: string; epoch: string; createdAt: string }
) {
  return ctx.db.insert('campaignLiveAuthorities', {
    campaignId,
    epoch,
    phase: 'DO_ACTIVE',
    activationFingerprint: '0'.repeat(64),
    persistedSequence: 0,
    persistedStateChecksum: '0'.repeat(64),
    createdAt,
    updatedAt: createdAt
  })
}
