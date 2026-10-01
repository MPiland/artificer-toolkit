import { vi } from 'vitest'
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
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  encounterExecuteInputSchema,
  type EncounterCommandInputDto,
  type EncounterCommandResultDto,
  type ResolveRuleOccurrenceInputDto,
  type VoidRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type { SceneGeometryCommandResult } from '@artificer-toolkit/schema/api/sceneGeometry'
import type { SceneTokenMovementCommandInputDto } from '@artificer-toolkit/schema/api/vttScenes'
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
import { api } from '../../convex/_generated/api'
import { createConvexEncounterStoreReader } from '../../convex/lib/convexEncounterStore'
import type { MutationCtx, QueryCtx } from '../../convex/_generated/server'
import * as rollRandom from '../../convex/lib/rollRandom'
import type schema from '../../convex/schema'
import { parseGeometrySave } from '@artificer-toolkit/encounter-persistence/sceneGeometryDocuments'
import { persistSpatialPreparation } from '../../convex/scenes/spatialPreparationPersistence'
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
import { planNativeLiveCleavingResponse } from '../../../session-worker/src/nativeCleavingResponse'
import { planNativeLiveConcentrationResponse } from '../../../session-worker/src/nativeConcentrationResponse'
import { planNativeLiveDisarm } from '../../../session-worker/src/nativeDisarm'
import { planNativeLiveEncounterAction } from '../../../session-worker/src/nativeEncounterRules'
import { planNativeLiveEncounterTurn } from '../../../session-worker/src/nativeEncounterTurn'
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
import type { LiveCaptureReads } from '../../../session-worker/src/nativeCaptureCache'
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
 * Sends one Encounter command through the room's dispatcher (`executeLiveEncounterCommand`) as a
 * member. The Campaign needs an active live authority at `actor.authorityEpoch`. A movement decision
 * commits with the presented Scene (`stageRoomMovement`).
 */
export function executeRoomEncounterCommand(input: {
  caller: Pick<MemberCaller, 'fetch' | 'run'>
  actor: LiveEncounterActor
  command: EncounterCommandInputDto
  random?: (maximum: number) => number
}): Promise<EncounterCommandResultDto> {
  const random = input.random ?? secureRandomInt
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
    throw roomRefusal(error)
  } finally {
    if (createdAuthority) await caller.run((ctx) => ctx.db.delete(createdAuthority))
  }
}

/** A domain rejection surfaces as the ConvexError data the browser receives; others stay redacted. */
function roomRefusal(error: unknown) {
  return error instanceof LiveSessionDomainRejectionError ? new ConvexError(error.rejection) : error
}

/**
 * Sends an Encounter command through the room as the caller's Campaign member, the way a browser
 * does (see `asRoomMember`). The room's dice come from `nextRollInt` unless `random` is given, so a
 * test's spy on it drives them.
 */
export async function executeInRoom(
  caller: MemberCaller,
  input: z.input<typeof encounterExecuteInputSchema>,
  random?: (maximum: number) => number
): Promise<EncounterCommandResultDto> {
  const { command } = encounterExecuteInputSchema.parse(input)
  return asRoomMember(caller, command.encounterId, (actor) =>
    executeRoomEncounterCommand({
      caller,
      actor,
      command,
      random: random ?? ((maximum) => rollRandom.nextRollInt(maximum))
    })
  )
}

/**
 * Retries a settled command as a lost acknowledgement's retry reaches the room. A root command
 * retries through the room. A settled decision is no longer routable (the room refuses it as
 * stale), so its retry is shown at its planner, which must return the stored result without rolling.
 */
export async function replayInRoom(
  caller: MemberCaller,
  input: z.input<typeof encounterExecuteInputSchema>
): Promise<EncounterCommandResultDto> {
  const { command } = encounterExecuteInputSchema.parse(input)
  if (command.type !== 'RESOLVE_RULE_OCCURRENCE') return executeInRoom(caller, { command })
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
  const planner =
    owner === 'ACTION'
      ? planNativeLiveEncounterAction
      : owner === 'CONCENTRATION'
        ? planNativeLiveConcentrationResponse
        : owner === 'CLEAVING'
          ? planNativeLiveCleavingResponse
          : owner === 'DISARM'
            ? planNativeLiveDisarm
            : // A settled turn decision keeps no pending context, so it classifies as OTHER.
              planNativeLiveEncounterTurn
  return asRoomMember(caller, command.encounterId, (actor) =>
    withRoomConvex(caller, async ({ environment, accessToken, runtime }) => {
      const plan = await planner(
        environment,
        accessToken,
        {
          ...actor,
          encounterId: command.encounterId.toLowerCase(),
          expectedVersion: command.expectedVersion
        },
        command,
        {
          runtime,
          random: () => {
            throw new Error('A replay must not roll.')
          }
        }
      )
      if (plan.kind !== 'REPLAY')
        throw new Error('Expected the planner to replay a settled decision.')
      return plan.result
    })
  )
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
              if (!(error instanceof LiveSessionRouteError)) throw error
              const refusal = encounterCommandRefusal(error)
              throw new Error(`${refusal.code}: ${refusal.message}`)
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
