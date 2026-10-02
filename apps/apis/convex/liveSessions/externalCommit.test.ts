import { makeFunctionReference } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import type {
  ResolveRuleOccurrenceInputDto,
  VoidRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type { SceneGeometryCommandResult } from '@artificer-toolkit/schema/api/sceneGeometry'
import { MOVEMENT_DECISION_SKIPPED_MESSAGE } from '@artificer-toolkit/schema/api/campaignCommunication'
import type {
  EncounterDecisionSettlementDto,
  EncounterSessionStateDto,
  GetEncounterDecisionSettlementInputDto
} from '@artificer-toolkit/schema/api/encounterData'
import type {
  SceneGeometryCommandInputDto,
  SetCampaignLiveScenePresentationInputDto,
  SetCampaignLiveScenePresentationResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { callLiveSessionRoute } from '../../../session-worker/src/liveSessionRoutes'
import { LiveCaptureCache } from '../../../session-worker/src/nativeCaptureCache'
import {
  commitExternalSceneCommit,
  prepareExternalSceneCommit,
  type ExternalSceneCommand,
  type ExternalSceneContext
} from '../../../session-worker/src/nativeExternalSceneCommit'
import { createNativeLiveRulesRuntime } from '../../../session-worker/src/nativeRulesRuntime'
import { hydrateNativeTransientScene } from '../../../session-worker/src/nativeSceneClient'
import { setupAutomaticSceneMovement } from '../../tests/fixtures/automaticSceneMovement'
import {
  executeInRoom,
  insertActiveLiveAuthority,
  nextExternalAuthority,
  planMovementDecisionInRoom,
  planMovementInRoom,
  stubLiveSessionFetch,
  workerEnvironment
} from '../../tests/fixtures/liveSessionWorker'
import {
  createSceneDefinitionFixture,
  publishEmptyScene
} from '../../tests/fixtures/sceneDefinitions'

const workerSecret = 'external-commit-worker-test-secret-at-least-32-bytes'
const environment = workerEnvironment(workerSecret)
const executeGeometry = makeFunctionReference<
  'action',
  { input: SceneGeometryCommandInputDto },
  SceneGeometryCommandResult
>('scenes/geometryActions:execute')
const setPresentation = makeFunctionReference<
  'mutation',
  SetCampaignLiveScenePresentationInputDto,
  SetCampaignLiveScenePresentationResultDto
>('scenes/presentations:set')
const activeState = makeFunctionReference<
  'query',
  { campaignId: string },
  EncounterSessionStateDto
>('encounters/activeReads:active')
const decisionSettlement = makeFunctionReference<
  'query',
  GetEncounterDecisionSettlementInputDto,
  EncounterDecisionSettlementDto
>('encounters/activeReads:decisionSettlement')

type Caller = Awaited<ReturnType<typeof setupAutomaticSceneMovement>>['owner']['caller']
type Base = Pick<Awaited<ReturnType<typeof setupAutomaticSceneMovement>>['base'], 't' | 'campaign'>

// Two reactors in reach of the move each offer an Assisted Use/Decline choice.
const twoChoices = {
  policies: ['CHOICE', 'CHOICE'] as const,
  reactorPositions: [150, 150] as const,
  path: [
    { x: 150, y: 50 },
    { x: 450, y: 50 }
  ]
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

/** Routes the room's private calls into convex-test as `member`, recording each command's calls. */
const calls: string[] = []
function routeRoom(member: { caller: Caller }) {
  vi.stubEnv('LIVE_SESSION_WORKER_SECRET', workerSecret)
  stubLiveSessionFetch(async (pathname, init) => {
    // A rules capture is named by its request kind.
    calls.push(
      pathname === '/live-sessions/encounter-rules'
        ? `${pathname}:${(JSON.parse(String(init?.body)) as { request: { kind: string } }).request.kind}`
        : pathname
    )
    return member.caller.fetch(pathname, init)
  })
}

async function activateRoom(base: Base) {
  const epoch = crypto.randomUUID()
  await base.t.run((ctx) =>
    insertActiveLiveAuthority(ctx, {
      campaignId: base.campaign.id,
      epoch,
      createdAt: base.campaign.createdAt
    })
  )
  return epoch
}

/** The room's shared Scene cache, read through the same capture and hydration as the room. */
async function roomContext(actor: {
  campaignId: string
  expectedUserId: string
  expectedRole: 'OWNER' | 'PLAYER'
}): Promise<ExternalSceneContext> {
  const capture = await callLiveSessionRoute(environment, 'fixture-access-token', 'capture', {
    campaignId: actor.campaignId,
    expectedUserId: actor.expectedUserId,
    expectedRole: actor.expectedRole,
    mode: 'FULL',
    observedCharacterRevisions: [],
    recipientUserIds: []
  })
  const hydrated = await hydrateNativeTransientScene(environment, 'fixture-access-token', capture)
  if (!hydrated.scene || !capture.presentation) throw new Error('Expected a presented Scene.')
  return {
    scene: hydrated.scene,
    baseOrdinals: hydrated.baseOrdinals,
    characterRevisions: hydrated.characterRevisions,
    presentation: { expectedPresentationVersion: capture.presentation.version }
  }
}

async function persisted(base: Base) {
  return base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('campaignLiveAuthorities')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
      .unique()
    return { sequence: row?.persistedSequence, checksum: row?.persistedStateChecksum }
  })
}

async function runRoomCommit(input: {
  base: Base
  member: { caller: Caller; userId: string }
  role: 'OWNER' | 'PLAYER'
  epoch: string
  command: ExternalSceneCommand
}) {
  const actor = {
    campaignId: input.base.campaign.id,
    authorityEpoch: input.epoch,
    expectedUserId: input.member.userId,
    expectedRole: input.role
  }
  const context = await roomContext(actor)
  calls.length = 0
  const prepared = await prepareExternalSceneCommit({
    environment,
    accessToken: 'fixture-access-token',
    actor,
    command: input.command,
    context,
    runtime: await createNativeLiveRulesRuntime(process.env.RULES_CONTINUATION_SECRET!),
    random: () => 0,
    captures: new LiveCaptureCache().reads()
  })
  const authority = await input.base.t.run((ctx) =>
    nextExternalAuthority(ctx, input.base.campaign.id)
  )
  return {
    prepared,
    authority,
    commit: () =>
      commitExternalSceneCommit({
        environment,
        accessToken: 'fixture-access-token',
        actor,
        prepared,
        authority
      })
  }
}

it('settles a bound move, its answer and a GM skip through the room, naming who settled each (D26, D39)', async () => {
  const value = await setupAutomaticSceneMovement(twoChoices)
  const moved = await planMovementInRoom(value.owner.caller, {
    ...value.rootInput,
    commandId: crypto.randomUUID()
  })
  const first = await moved.publish()
  expect(first).toMatchObject({
    occurrence: { status: 'PENDING', pending: { kind: 'MOVEMENT_REACTION' } }
  })
  const choice = first.occurrence?.pending
  if (choice?.kind !== 'MOVEMENT_REACTION') throw new Error('Expected a reaction choice.')
  const answer: ResolveRuleOccurrenceInputDto = {
    type: 'RESOLVE_RULE_OCCURRENCE',
    commandId: crypto.randomUUID(),
    encounterId: value.base.run.id,
    expectedVersion: choice.encounterVersion,
    occurrenceId: choice.occurrenceId,
    expectedOccurrenceVersion: choice.occurrenceVersion,
    correlationId: null,
    resolution: { kind: 'DECLINE' }
  }
  const second = await (await planMovementDecisionInRoom(value.owner.caller, answer)).publish()
  expect(second.occurrence).toMatchObject({ occurrenceId: choice.occurrenceId })

  const next = second.occurrence?.pending
  if (next?.kind !== 'MOVEMENT_REACTION') throw new Error('Expected the second reaction choice.')
  const skip: VoidRuleOccurrenceInputDto = {
    type: 'VOID_RULE_OCCURRENCE',
    commandId: crypto.randomUUID(),
    encounterId: value.base.run.id,
    expectedVersion: next.encounterVersion,
    occurrenceId: next.occurrenceId,
    expectedOccurrenceVersion: next.occurrenceVersion
  }
  const third = await executeInRoom(value.owner.caller, { command: skip })
  // The void declined the choice: the move finished and the void is on the timeline.
  expect(third.occurrence).toMatchObject({ status: 'COMPLETE' })
  const chat = await value.base.t.run((ctx) =>
    ctx.db
      .query('campaignConversationEntries')
      .withIndex('by_campaignId_authorUserId_clientNonce', (q) =>
        q
          .eq('campaignId', value.base.campaign.id)
          .eq('authorUserId', value.owner.userId)
          .eq('clientNonce', skip.commandId)
      )
      .unique()
  )
  const payload = await value.base.t.run((ctx) =>
    ctx.db
      .query('campaignConversationEntryPayloads')
      .withIndex('by_entryId', (q) => q.eq('entryId', chat!.id))
      .unique()
  )
  expect(payload).toMatchObject({ kind: 'CHAT', body: MOVEMENT_DECISION_SKIPPED_MESSAGE })
  // The decision read model records who settled each decision, for the player's drawer (D39).
  const settlement = (decision: { occurrenceId: string; occurrenceVersion: number }) =>
    value.player.caller.query(decisionSettlement, {
      encounterId: value.base.run.id,
      occurrenceId: decision.occurrenceId,
      occurrenceVersion: decision.occurrenceVersion
    })
  expect(await settlement(choice)).toBe('ANSWER')
  expect(await settlement(next)).toBe('GM_SKIP')
  // Every published segment of the move, before and after both decisions, counts toward the
  // mover's turn: the whole 300 px path over 100 px, 5 ft cells (D38).
  const state = await value.owner.caller.query(activeState, { campaignId: value.base.campaign.id })
  expect(state.turnMovement).toContainEqual({
    actorId: value.geometry.actorIdByTokenId.get(value.moverTokenId),
    used: 15,
    budget: 40
  })
}, 120_000)

it("refuses a player moving a reactor's token, answering the GM's decision, or answering a stale one", async () => {
  const value = await setupAutomaticSceneMovement(twoChoices)
  const [reactorToken] = value.tokens
  if (!reactorToken) throw new Error('Expected a reactor token.')
  // The player controls only the mover; a reactor's token follows its actor's controllers.
  await expect(
    planMovementInRoom(value.player.caller, {
      ...value.rootInput,
      commandId: crypto.randomUUID(),
      tokenId: value.reactorTokenIds[0]!,
      path: [reactorToken.position, { x: reactorToken.position.x, y: 450 }]
    })
  ).rejects.toThrow()
  const choice = (await (await planMovementInRoom(value.owner.caller, value.rootInput)).publish())
    .occurrence?.pending
  if (choice?.kind !== 'MOVEMENT_REACTION') throw new Error('Expected a reaction choice.')
  const answer: ResolveRuleOccurrenceInputDto = {
    type: 'RESOLVE_RULE_OCCURRENCE',
    commandId: crypto.randomUUID(),
    encounterId: value.base.run.id,
    expectedVersion: choice.encounterVersion,
    occurrenceId: choice.occurrenceId,
    expectedOccurrenceVersion: choice.occurrenceVersion,
    correlationId: null,
    resolution: { kind: 'DECLINE' }
  }
  await expect(planMovementDecisionInRoom(value.player.caller, answer)).rejects.toThrow()
  await expect(
    planMovementDecisionInRoom(value.owner.caller, { ...answer, occurrenceId: crypto.randomUUID() })
  ).rejects.toThrow()
  // The refusals staged nothing: the GM's answer still settles the same choice.
  expect(
    (await (await planMovementDecisionInRoom(value.owner.caller, answer)).publish()).occurrence
  ).toMatchObject({ occurrenceId: choice.occurrenceId })
}, 120_000)
it('commits an unbound fog-deriving move under live authority and stages its owner layer', async () => {
  const base = await createSceneDefinitionFixture()
  const { sceneId } = await publishEmptyScene(base)
  await base.owner.caller.mutation(setPresentation, {
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: null,
    campaignId: base.campaign.id,
    sceneId,
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION'
  })
  const token = {
    assetId: null,
    controlledByUserIds: [base.other.userId],
    height: 1,
    hidden: false,
    id: crypto.randomUUID(),
    label: 'Scout',
    locked: false,
    position: { x: 100, y: 100 },
    rotationDegrees: 0,
    // A short sight line, so the move explores cells its starting view did not.
    vision: { angleDegrees: 360, brightRange: 0, dimRange: 5, directionDegrees: 0, enabled: true },
    width: 1
  }
  await base.owner.caller.action(executeGeometry, {
    input: {
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 0,
      sceneId,
      token,
      type: 'UPSERT_SCENE_TOKEN'
    }
  })
  const epoch = await activateRoom(base)
  routeRoom(base.owner)
  const moved = await runRoomCommit({
    base,
    member: base.owner,
    role: 'OWNER',
    epoch,
    command: {
      type: 'MOVE_SCENE_TOKEN',
      commandId: crypto.randomUUID(),
      sceneId,
      tokenId: token.id,
      expectedSceneVersion: 1,
      expectedEncounterVersion: null,
      correlationId: null,
      movementKind: 'VOLUNTARY',
      path: [token.position, { x: 900, y: 100 }]
    }
  })
  const committed = await moved.commit()
  // The owner's explored layer travels with the commit, which stages it in its transaction (D52).
  expect(calls).toEqual([
    '/live-sessions/encounter-movement-stage',
    '/live-sessions/scene-geometry'
  ])
  expect(moved.prepared.fogChanged).toBe(true)
  expect(committed.scene.fogPatches).toEqual([
    expect.objectContaining({ ownerUserId: base.other.userId, mode: 'REPLACE' })
  ])
  expect(committed.scene).toMatchObject({ version: 2, delta: moved.prepared.expectedScene.delta })
  expect(await persisted(base)).toEqual({ sequence: 1, checksum: moved.authority.stateChecksum })
}, 120_000)

it('counts voluntary bound movement toward the turn, outside the Run version (D38, V07.5)', async () => {
  // Reactors far from the path, so each move publishes uninterrupted.
  const value = await setupAutomaticSceneMovement({ reactorPositions: [850, 850] })
  const moverId = value.geometry.actorIdByTokenId.get(value.moverTokenId)!
  const readRun = () =>
    value.base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', value.base.run.id))
        .unique()
      if (!row) throw new Error('Missing Encounter Run.')
      return row
    })
  const move = async (
    path: { x: number; y: number }[],
    movementKind: 'VOLUNTARY' | 'FORCED',
    expectedSceneVersion: number
  ) =>
    (
      await planMovementInRoom(value.owner.caller, {
        ...value.rootInput,
        commandId: crypto.randomUUID(),
        expectedSceneVersion,
        movementKind,
        path
      })
    ).publish()
  const moverMovement = async () =>
    (
      await value.owner.caller.query(activeState, { campaignId: value.base.campaign.id })
    ).turnMovement.find((entry) => entry.actorId === moverId)
  const before = await readRun()

  const first = await move(
    [
      { x: 150, y: 50 },
      { x: 350, y: 50 }
    ],
    'VOLUNTARY',
    0
  )
  expect(first.occurrence).toBeNull()
  expect(await moverMovement()).toEqual({ actorId: moverId, used: 10, budget: 40 })
  // Moves in one turn accumulate.
  const second = await move(
    [
      { x: 350, y: 50 },
      { x: 250, y: 50 }
    ],
    'VOLUNTARY',
    first.version
  )
  expect(await moverMovement()).toMatchObject({ used: 15 })
  // Forced movement does not spend the mover's own movement.
  await move(
    [
      { x: 250, y: 50 },
      { x: 150, y: 50 }
    ],
    'FORCED',
    second.version
  )
  expect(await moverMovement()).toMatchObject({ used: 15 })
  // The record bumps nothing on the Run: no version, no state change.
  const after = await readRun()
  expect({ version: after.version, stateChecksum: after.stateChecksum }).toEqual({
    version: before.version,
    stateChecksum: before.stateChecksum
  })
  // A new turn reads a new key and starts at zero.
  await executeInRoom(value.owner.caller, {
    command: {
      type: 'SET_CURRENT_ACTOR',
      encounterId: value.base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: after.version,
      actorId: moverId
    }
  })
  expect(await moverMovement()).toMatchObject({ used: 0 })
}, 120_000)
/** A presented, fog-on Scene with a player's seeing token and one door per state (V03.4, V07.4). */
async function setupPlayerScene() {
  const base = await createSceneDefinitionFixture()
  const { sceneId } = await publishEmptyScene(base)
  await base.owner.caller.mutation(setPresentation, {
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: null,
    campaignId: base.campaign.id,
    sceneId,
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION'
  })
  const token = (label: string, controlledByUserIds: string[], x: number) => ({
    assetId: null,
    controlledByUserIds,
    height: 1,
    hidden: false,
    id: crypto.randomUUID(),
    label,
    locked: false,
    position: { x, y: 100 },
    rotationDegrees: 0,
    vision: { angleDegrees: 360, brightRange: 0, dimRange: 60, directionDegrees: 0, enabled: true },
    width: 1
  })
  const door = (initialState: 'CLOSED' | 'LOCKED', x: number) => ({
    a: { x, y: 0 },
    b: { x, y: 400 },
    blocksLightWhenClosed: true,
    blocksMovementWhenClosed: true,
    id: crypto.randomUUID(),
    initialState,
    kind: 'DOOR' as const,
    openAngleDegrees: 90
  })
  const scout = token('Scout', [base.other.userId], 100)
  const sentry = token('Sentry', [], 700)
  const closed = door('CLOSED', 200)
  const locked = door('LOCKED', 600)
  let version = 0
  // Doors first, so the scout's first view stops at the closed door.
  for (const input of [
    { type: 'UPSERT_SCENE_BARRIER' as const, barrier: closed },
    { type: 'UPSERT_SCENE_BARRIER' as const, barrier: locked },
    { type: 'UPSERT_SCENE_TOKEN' as const, token: scout },
    { type: 'UPSERT_SCENE_TOKEN' as const, token: sentry }
  ])
    version = (
      await base.owner.caller.action(executeGeometry, {
        input: { ...input, commandId: crypto.randomUUID(), expectedSceneVersion: version, sceneId }
      })
    ).version
  const epoch = await activateRoom(base)
  routeRoom(base.other)
  const player = (command: ExternalSceneCommand) =>
    runRoomCommit({ base, member: base.other, role: 'PLAYER', epoch, command })
  return { base, sceneId, scout, sentry, closed, locked, version, player }
}

it("commits a player's door change on a fog-on Scene through the room, refusing a locked door (V03.4)", async () => {
  const value = await setupPlayerScene()
  const door = (barrierId: string, expectedSceneVersion: number) => ({
    type: 'SET_SCENE_DOOR_STATE' as const,
    commandId: crypto.randomUUID(),
    sceneId: value.sceneId,
    expectedSceneVersion,
    barrierId,
    state: 'OPEN' as const
  })
  const opened = await value.player(door(value.closed.id, value.version))
  const committed = await opened.commit()
  // The player's opened door explores through it: the commit stages the fog as it publishes.
  expect(calls).toEqual([
    '/live-sessions/encounter-movement-stage',
    '/live-sessions/scene-geometry'
  ])
  expect(opened.prepared.fogChanged).toBe(true)
  expect(committed.scene).toMatchObject({
    version: value.version + 1,
    delta: { kind: 'DOOR_STATE_SET', barrierId: value.closed.id, state: 'OPEN' },
    fogPatches: [expect.objectContaining({ ownerUserId: value.base.other.userId })]
  })
  expect(await persisted(value.base)).toMatchObject({ sequence: 1 })

  // Only the GM changes a locked door; publication refuses the player and nothing advances.
  await expect(
    value.player(door(value.locked.id, value.version + 1)).then((refused) => refused.commit())
  ).rejects.toMatchObject({ status: 409 })
  expect(await persisted(value.base)).toMatchObject({ sequence: 1 })
}, 120_000)

it('commits a player move of a controlled unbound token through the room, refusing others (V07.4)', async () => {
  const value = await setupPlayerScene()
  const move = (tokenId: string, from: { x: number; y: number }, expectedSceneVersion: number) => ({
    type: 'MOVE_SCENE_TOKEN' as const,
    commandId: crypto.randomUUID(),
    sceneId: value.sceneId,
    tokenId,
    expectedSceneVersion,
    expectedEncounterVersion: null,
    correlationId: null,
    movementKind: 'VOLUNTARY' as const,
    path: [from, { x: from.x + 50, y: from.y }]
  })
  const moved = await value.player(move(value.scout.id, value.scout.position, value.version))
  const committed = await moved.commit()
  expect(committed.scene).toMatchObject({
    version: value.version + 1,
    delta: { kind: 'TOKEN_MOVED', tokenId: value.scout.id, position: { x: 150, y: 100 } }
  })
  expect(await persisted(value.base)).toMatchObject({ sequence: 1 })

  // The player does not control the sentry: publication refuses the move.
  await expect(
    value
      .player(move(value.sentry.id, value.sentry.position, value.version + 1))
      .then((refused) => refused.commit())
  ).rejects.toMatchObject({ status: 409 })
  expect(await persisted(value.base)).toMatchObject({ sequence: 1 })
}, 120_000)
