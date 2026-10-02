import { beforeEach, expect, vi } from 'vitest'
import type {
  LiveSessionExpectedScene,
  LiveSessionExternalAuthority,
  LiveSessionMovementPrepareInput
} from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import {
  preparedMovementCost,
  preparedMovementSceneDelta
} from '@artificer-toolkit/rules-runtime/encounterMovementPublication'
import { CharacterSheetCommandError } from '@artificer-toolkit/rules-runtime/character/sheetCommandError'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
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
import type { SceneTokenMovementCommandInputDto } from '@artificer-toolkit/schema/api/vttScenes'
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
import type { MutationCtx, QueryCtx } from '../../convex/_generated/server'
import * as rollRandom from '../../convex/lib/rollRandom'
import type schema from '../../convex/schema'
import { parseGeometrySave } from '@artificer-toolkit/encounter-persistence/sceneGeometryDocuments'
import { persistSpatialPreparation } from '../../convex/scenes/spatialPreparationPersistence'
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
  executeLiveEncounterCommand,
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
import { commitLiveMovement } from '../../convex/liveSessions/encounterMovementCommit'
import {
  commitExternalSceneCommit,
  prepareExternalSceneCommit,
  type ExternalSceneContext,
  type ExternalSceneCommand
} from '../../../session-worker/src/nativeExternalSceneCommit'
import { prepareNativeLiveMovement } from '../../../session-worker/src/nativeEncounterMovement'
import { hydrateNativeTransientScene } from '../../../session-worker/src/nativeSceneClient'
import {
  LiveCaptureCache,
  type LiveCaptureReads
} from '../../../session-worker/src/nativeCaptureCache'
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
 * The room's Scene cache for `encounterId`, read through the same capture and hydration as the
 * room; null when the presented Scene is not bound to that Encounter, so the room does not own it.
 */
async function roomSceneContext(
  room: { environment: ReturnType<typeof workerEnvironment>; accessToken: string },
  actor: Omit<LiveEncounterActor, 'authorityEpoch'>,
  encounterId: string
): Promise<ExternalSceneContext | null> {
  const capture = await callLiveSessionRoute(room.environment, room.accessToken, 'capture', {
    campaignId: actor.campaignId,
    expectedUserId: actor.expectedUserId,
    expectedRole: actor.expectedRole,
    mode: 'FULL',
    observedCharacterRevisions: [],
    recipientUserIds: []
  })
  if (!capture.presentation || capture.sceneEncounterId !== encounterId.toLowerCase()) return null
  const hydrated = await hydrateNativeTransientScene(room.environment, room.accessToken, capture)
  if (!hydrated.scene) return null
  return {
    scene: hydrated.scene,
    baseOrdinals: hydrated.baseOrdinals,
    characterRevisions: hydrated.characterRevisions,
    presentation: { expectedPresentationVersion: capture.presentation.version }
  }
}

type RoomSession = Awaited<Parameters<Parameters<typeof withRoomConvex>[1]>[0]>

/**
 * Plans an Encounter-bound move or movement decision as the room does with its presented Scene
 * (D27): the planned outcome, and a commit that publishes it Convex-first with the room's next
 * authority. Off the presented Scene it is refused (D42).
 */
async function stageRoomMovement(input: {
  caller: Pick<MemberCaller, 'run'>
  room: RoomSession
  actor: LiveEncounterActor
  encounterId: string
  command: ExternalSceneCommand
  random: (maximum: number) => number
  captures?: LiveCaptureReads
}) {
  const { caller, room, actor } = input
  const context = await roomSceneContext(room, actor, input.encounterId)
  if (!context) throw sceneNotPresentedRejection()
  const prepared = await prepareExternalSceneCommit({
    ...room,
    actor,
    command: input.command,
    context,
    random: input.random,
    captures: input.captures
  })
  if (prepared.kind !== 'MOVEMENT') throw new Error('Expected an Encounter movement commit.')
  return {
    saveId: prepared.saveId,
    outcome: prepared.commit.preparation.outcome,
    commit: async () =>
      commitExternalSceneCommit({
        ...room,
        actor,
        prepared,
        authority: await caller.run((ctx) => nextExternalAuthority(ctx, actor.campaignId))
      })
  }
}

/**
 * The Convex-first comparator: one Encounter command through the room's dispatcher
 * (`executeLiveEncounterCommand`), which commits through Convex routes. A movement decision commits
 * with the presented Scene (`stageRoomMovement`).
 */
function executeConvexFirstCommand(input: {
  caller: Pick<MemberCaller, 'fetch' | 'run'>
  actor: LiveEncounterActor
  command: EncounterCommandInputDto
  random: (maximum: number) => number
}): Promise<EncounterCommandResultDto> {
  const { random } = input
  return withRoomConvex(input.caller, (room) =>
    executeLiveEncounterCommand({
      ...room,
      actor: input.actor,
      command: input.command,
      random,
      movement: async (command, captures) => {
        const staged = await stageRoomMovement({
          caller: input.caller,
          room,
          actor: input.actor,
          encounterId: command.encounterId,
          command,
          random,
          captures
        })
        const { encounter } = await staged.commit()
        if (!encounter) throw new Error('A movement decision commit returned no Encounter result.')
        return encounter
      }
    })
  )
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
    reason: typeof reason === 'string' ? expect.stringContaining(reason) : expect.stringMatching(reason)
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

/** A room refusal whose code and message the room sends as they are. */
function roomRefusal(code: RoomCommandRefusal['code'], message: string) {
  return new RoomCommandRefusal(new Error(message), { code, message })
}

/**
 * Sends one Encounter command to the room as a member, the way the Session room commits it (D78):
 * a fresh room store hydrated over node SQLite from the Convex room inputs at the authority's
 * persisted checkpoint, the room-native executor in one room transaction with no HTTP, then the
 * room's checkpoint published through the real checkpoint mutation before this returns. The
 * Campaign needs an active live authority at `actor.authorityEpoch`. A domain rejection surfaces as
 * the ConvexError data the browser receives; any other refusal as a redacted `RoomCommandRefusal`.
 * A movement decision still commits Convex-first with the presented Scene until A35-S6c2.
 */
export async function executeRoomEncounterCommand(input: {
  caller: MemberCaller
  actor: LiveEncounterActor
  command: EncounterCommandInputDto
  random?: (maximum: number) => number
}): Promise<EncounterCommandResultDto> {
  const { caller, actor, command } = input
  const random = input.random ?? secureRandomInt
  const { campaignId, authorityEpoch: epoch, expectedUserId: userId } = actor
  const encounterId = command.encounterId.toLowerCase()
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
  const fetch = globalThis.fetch
  globalThis.fetch = async () => {
    throw new Error('The room-native path attempted an HTTP request.')
  }
  try {
    const store = new RoomEncounterStore(storage)
    const inputs = new RoomInputs(
      store,
      (inputEpoch, scope) =>
        caller.query(internal.liveSessions.roomInputs.read, {
          campaignId,
          epoch: inputEpoch,
          scope
        }),
      (manifest) => loadRoomContentSnapshots(contentSnapshots, manifest, campaignId)
    )
    const fingerprint = roomEncounterCommandFingerprint(command)
    const journalKey = `${campaignId}:${command.commandId}`
    // As the room does, any failure from hydration to commit is refused to the member.
    const committed = await (async () => {
      await inputs.hydrate({
        epoch,
        encounterId,
        sceneId: read.sceneId,
        checkpoint: read.checkpoint
      })
      let movement = false
      if (command.type === 'RESOLVE_RULE_OCCURRENCE' || command.type === 'VOID_RULE_OCCURRENCE') {
        const route = await readRoomEncounterResponseRoute(store, command)
        const native =
          command.type === 'VOID_RULE_OCCURRENCE'
            ? await roomOwnsEncounterVoid(store, command)
            : route !== null && route !== 'MOVEMENT'
        movement = route === 'MOVEMENT' && !native
      }
      // As the room does, a reused command ID is looked up in the journal before execution.
      const prior = roomJournal.get(journalKey)
      if (prior) {
        if (prior.userId !== userId || prior.fingerprint !== fingerprint)
          throw roomRefusal('INVALID_COMMAND', 'The command ID was already used for different input.')
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
      if (movement) return null
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
            random,
            turnExecution: {
              environment: workerEnvironment(ROOM_WORKER_SECRET),
              runtime,
              captures: new LiveCaptureCache().reads()
            }
          }),
        // As the room does, every command commits one journal entry with its receipt.
        () => undefined
      )
      const own = transacted.recipients.get(userId)
      if (!own) throw new Error('The room produced no result for its submitter.')
      roomJournal.set(journalKey, { userId, fingerprint, resultJson: JSON.stringify(own) })
      return { kind: 'COMMITTED' as const, result: own }
    })().catch((error: unknown) => {
      // As the room does, a Sheet refusal reaches the member with its own message.
      if (error instanceof CharacterSheetCommandError || error instanceof RoomCommandRefusal)
        throw error
      throw domainRejection(error) ?? new RoomCommandRefusal(error)
    })
    if (!committed) {
      // The Convex-first movement commit routes its own requests (`withRoomConvex`).
      const result = await executeConvexFirstCommand({ caller, actor, command, random })
      roomJournal.set(journalKey, { userId, fingerprint, resultJson: null })
      return result
    }
    if (committed.kind === 'REPLAY') return committed.result
    await new RoomCheckpoints(store, storage, (checkpoint) =>
      caller.mutation(internal.liveSessions.checkpoint.publish, checkpoint)
    ).flush({ campaignId, epoch, knownAuthorization: null })
    return committed.result
  } finally {
    globalThis.fetch = fetch
    database.close()
  }
}

type MemberCaller = ReturnType<TestConvex<typeof schema>['withIdentity']>

/**
 * Runs room work as the caller's Campaign member on `encounterId`. A Campaign without a live
 * authority gets an active one for this work only, so the rest of a test keeps its non-live
 * Campaign. A domain rejection surfaces as the ConvexError data the browser receives; any other
 * refusal stays redacted, as the room reports it.
 */
function asRoomMember<T>(
  caller: MemberCaller,
  encounterId: string,
  work: (actor: LiveEncounterActor) => Promise<T>,
  temporaryEpoch?: () => string | undefined
): Promise<T> {
  // The room runs one command at a time, so concurrent test commands queue as they would there.
  const turn = roomQueue.then(() => runAsRoomMember(caller, encounterId, work, temporaryEpoch))
  roomQueue = turn.catch(() => undefined)
  return turn
}

let roomQueue: Promise<unknown> = Promise.resolve()

async function runAsRoomMember<T>(
  caller: MemberCaller,
  encounterId: string,
  work: (actor: LiveEncounterActor) => Promise<T>,
  temporaryEpoch?: () => string | undefined
): Promise<T> {
  const identity = await caller.query(api.account.identity, {})
  if (!identity) throw new Error('Unauthenticated: the Session room admits only signed-in members.')
  const { actor, createdAuthority } = await caller.run(async (ctx) => {
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', encounterId.toLowerCase()))
      .unique()
    if (!run) throw new Error('Encounter is unavailable.')
    const membership = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', run.campaignId).eq('userId', identity.userId)
      )
      .unique()
    const authority = await ctx.db
      .query('campaignLiveAuthorities')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', run.campaignId))
      .unique()
    const authorityEpoch = authority?.epoch ?? temporaryEpoch?.() ?? crypto.randomUUID()
    return {
      actor: {
        campaignId: run.campaignId,
        authorityEpoch,
        expectedUserId: identity.userId,
        // A non-member is sent as a player so the room's own admission refuses them.
        expectedRole: membership?.role === 'OWNER' ? ('OWNER' as const) : ('PLAYER' as const)
      },
      createdAuthority: authority
        ? null
        : await insertActiveLiveAuthority(ctx, {
            campaignId: run.campaignId,
            epoch: authorityEpoch,
            createdAt: new Date().toISOString()
          })
    }
  })
  try {
    return await work(actor)
  } catch (error) {
    throw domainRejection(error) ?? error
  } finally {
    // The temporary authority ends as a release does, without its open-Run reconcile.
    if (createdAuthority)
      await caller.run(async (ctx) => {
        await releaseCharacterHolds(ctx, actor.campaignId, actor.authorityEpoch)
        await ctx.db.delete(createdAuthority)
      })
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
 * The Convex-first comparator for room parity: the same member and authority as `executeInRoom`,
 * with the command committed through the room's Convex routes instead of the room store.
 */
export async function executeConvexFirstInRoom(
  caller: MemberCaller,
  input: z.input<typeof encounterExecuteInputSchema>,
  random?: (maximum: number) => number
): Promise<EncounterCommandResultDto> {
  const { command } = encounterExecuteInputSchema.parse(input)
  return asRoomMember(caller, command.encounterId, (actor) =>
    executeConvexFirstCommand({ caller, actor, command, random: roomRandom(random) })
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

/**
 * Runs room work as `caller` on `encounterId` under one epoch: like `executeInRoom`, a Campaign
 * without a live authority is live only while each piece of work runs.
 */
function liveRoomMember(caller: MemberCaller, encounterId: string) {
  let epoch: string | undefined
  return <T>(work: (actor: LiveEncounterActor) => Promise<T>) =>
    asRoomMember(
      caller,
      encounterId,
      (actor) => {
        epoch ??= actor.authorityEpoch
        return work(actor)
      },
      () => epoch
    )
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

async function planInRoom(
  caller: MemberCaller,
  encounterId: string,
  command: ExternalSceneCommand
) {
  const whileLive = liveRoomMember(caller, encounterId)
  const staged = await whileLive((actor) =>
    withRoomConvex(caller, (room) =>
      stageRoomMovement({
        caller,
        room,
        actor,
        encounterId,
        command,
        random: (maximum) => rollRandom.nextRollInt(maximum)
      })
    )
  )
  return {
    saveId: staged.saveId,
    outcome: staged.outcome,
    publish: (): Promise<SceneGeometryCommandResult> =>
      whileLive(() => withRoomConvex(caller, async () => (await staged.commit()).scene))
  }
}

/**
 * Plans a movement decision as the room does with its presented Scene and returns the planned
 * outcome with `publish`, which commits it Convex-first; a test can inspect or disturb the plan in
 * between. Dice come from `nextRollInt`, so a test's spy on it drives them.
 */
export function planMovementDecisionInRoom(
  caller: MemberCaller,
  command: ResolveRuleOccurrenceInputDto | VoidRuleOccurrenceInputDto
) {
  return planInRoom(caller, command.encounterId, command)
}

/**
 * Stages and plans a new Encounter-bound move through the room, as a tabletop drag reaches it:
 * one stage (begin with the presented Scene's fence, observe, capture) and the rules plan; the
 * commit freezes the plan and stages fog.
 * Returns the move's save, the planned outcome and `publish`, like `planMovementDecisionInRoom`.
 */
export async function planMovementInRoom(
  caller: MemberCaller,
  command: SceneTokenMovementCommandInputDto
) {
  return planInRoom(caller, await sceneEncounterId(caller, command.sceneId), command)
}

/**
 * Plans a staged Encounter-bound move (its save already begun, with observed Character revisions)
 * as the room does with its presented Scene: the DO plans the rules, frozen on the save. Returns
 * the planned outcome with `publish`, like `planMovementDecisionInRoom`, and the commit input for a
 * test that commits it itself under a Campaign authority it inserted.
 */
export async function planStagedMovementInRoom(caller: MemberCaller, saveId: string) {
  const { sceneId, input, expectedEncounterVersion } = await caller.run(async (ctx) => {
    const row = await ctx.db
      .query('sceneGeometrySaves')
      .withIndex('by_publicId', (q) => q.eq('id', saveId.toLowerCase()))
      .unique()
    if (!row) throw new Error('Geometry save fixture is missing.')
    const save = parseGeometrySave(row)
    if (save.input.type !== 'MOVE_SCENE_TOKEN' || save.input.expectedEncounterVersion === null)
      throw new Error('Expected a staged Encounter-bound move.')
    return {
      sceneId: save.sceneId,
      input: save.input,
      expectedEncounterVersion: save.input.expectedEncounterVersion
    }
  })
  const encounterId = await sceneEncounterId(caller, sceneId)
  const whileLive = liveRoomMember(caller, encounterId)
  const staged = await whileLive((actor) =>
    withRoomConvex(caller, async (room) => {
      const context = await roomSceneContext(room, actor, encounterId)
      if (!context) throw sceneNotPresentedRejection()
      const baseOrdinal =
        context.baseOrdinals.tokens.find((entry) => entry.tokenId === input.tokenId)?.baseOrdinal ??
        null
      const movement = { encounterId, saveId: saveId.toLowerCase(), baseTokenOrdinal: baseOrdinal }
      const occurrenceId = crypto.randomUUID()
      const occurredAt = new Date().toISOString()
      const planned = await prepareNativeLiveMovement({
        ...room,
        scope: { ...actor, encounterId, expectedVersion: expectedEncounterVersion, movement },
        scene: context.scene,
        occurrenceId,
        occurredAt,
        random: (maximum) => rollRandom.nextRollInt(maximum)
      })
      const prepareInput: LiveSessionMovementPrepareInput = {
        ...actor,
        movement,
        preparation: {
          encounterId,
          expectedEncounterVersion,
          occurrenceId,
          occurredAt,
          outcome: planned.outcome
        },
        revisions: planned.revisions(),
        maintenanceOwners: planned.dependencies.flatMap(({ request }) =>
          request.kind === 'MAINTENANCE_OWNER' ? [request] : []
        )
      }
      // Freeze the plan now, as the commit would, so a test can inspect or disturb the frozen save
      // before it publishes; the commit then finds the identical preparation.
      await caller.run((ctx) =>
        persistSpatialPreparation(ctx, movement.saveId, prepareInput.preparation)
      )
      const walk = { path: input.path, startDistance: 0, outcome: planned.outcome }
      return {
        outcome: planned.outcome,
        commit: {
          ...prepareInput,
          finish: {
            saveId: movement.saveId,
            baseOrdinal,
            tokenOrdinals: context.baseOrdinals.tokens,
            movementCost: preparedMovementCost({
              ...walk,
              grid: context.scene.grid,
              scene: context.scene
            })
          },
          rules: planned.rules,
          settlements: planned.settlementInputs,
          fogLayers: []
        }
      }
    })
  )
  return {
    outcome: staged.outcome,
    /** The commit input without its authority advance and expected Scene. */
    commit: staged.commit,
    /** Commits through the private movement mutation itself, so a refusal keeps its message. */
    publish: (): Promise<SceneGeometryCommandResult> =>
      whileLive(async (actor) => {
        const { scene } = await caller.run(async (ctx) =>
          commitLiveMovement(ctx, {
            ...staged.commit,
            authority: await nextExternalAuthority(ctx, actor.campaignId),
            expectedScene: await expectedMovementScene(
              ctx,
              staged.commit.movement.saveId,
              staged.outcome
            )
          })
        )
        return scene
      })
  }
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

/** The room's next authority advance for a Convex-first commit (D27). */
export async function nextExternalAuthority(
  ctx: QueryCtx,
  campaignId: string
): Promise<LiveSessionExternalAuthority> {
  const authority = await ctx.db
    .query('campaignLiveAuthorities')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
    .unique()
  if (!authority) throw new Error('Live authority fixture is missing.')
  const sequence = authority.persistedSequence + 1
  return {
    sequence,
    expectedStateChecksum: authority.persistedStateChecksum,
    stateChecksum: checksumCanonicalJson({ campaignId, sequence })
  }
}

/** The Scene result a staged move publishes with its prepared outcome, as the room predicts it. */
export async function expectedMovementScene(
  ctx: QueryCtx,
  saveId: string,
  outcome: SceneSpatialPreparation['outcome'] | null
): Promise<LiveSessionExpectedScene> {
  const row = await ctx.db
    .query('sceneGeometrySaves')
    .withIndex('by_publicId', (q) => q.eq('id', saveId))
    .unique()
  if (!row) throw new Error('Geometry save fixture is missing.')
  const save = parseGeometrySave(row)
  if (save.input.type !== 'MOVE_SCENE_TOKEN') throw new Error('Expected a staged token move.')
  const delta = preparedMovementSceneDelta({
    tokenId: save.input.tokenId,
    path: save.input.path,
    outcome,
    sceneVersion: save.snapshotVersion
  })
  return {
    sceneId: save.sceneId,
    version: save.snapshotVersion + (delta || save.fogSaves.length ? 1 : 0),
    delta
  }
}
