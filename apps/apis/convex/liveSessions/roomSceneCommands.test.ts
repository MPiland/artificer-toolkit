import { makeFunctionReference } from 'convex/server'
import { expect, it } from 'vitest'
import { SRD_SPEEDS } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type {
  ResolveRuleOccurrenceInputDto,
  VoidRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { MOVEMENT_DECISION_SKIPPED_MESSAGE } from '@artificer-toolkit/schema/api/campaignCommunication'
import type {
  EncounterDecisionSettlementDto,
  EncounterSessionStateDto,
  GetEncounterDecisionSettlementInputDto
} from '@artificer-toolkit/schema/api/encounterData'
import type {
  SetCampaignLiveScenePresentationInputDto,
  SetCampaignLiveScenePresentationResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { api } from '../_generated/api'
import { setupAutomaticSceneMovement } from '../../tests/fixtures/automaticSceneMovement'
import { createPartyPlayer } from '../../tests/fixtures/partyPlayer'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  executeInRoom,
  executeSceneInRoom,
  deliverQueuedRoomControl,
  RoomCommandRefusal,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { createSceneDefinitionFixture, publishScene } from '../../tests/fixtures/sceneDefinitions'

useLocalRoomWorker()

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

/** The Campaign's live authority as the room's checkpoint leaves it for Convex. */
async function persisted(base: Base) {
  await checkpointLiveRoom(base.campaign.id)
  return base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('campaignLiveAuthorities')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
      .unique()
    return { sequence: row?.persistedSequence, checksum: row?.persistedStateChecksum }
  })
}

it('settles a bound move, its answer and a GM skip through the room, naming who settled each (D26, D39)', async () => {
  const value = await setupAutomaticSceneMovement(twoChoices)
  const first = (
    await executeSceneInRoom(value.owner.caller, {
      ...value.rootInput,
      commandId: crypto.randomUUID()
    })
  ).result
  expect(first).toMatchObject({
    occurrence: { status: 'PENDING', pending: { kind: 'MOVEMENT_REACTION' } }
  })
  const choice = first?.occurrence?.pending
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
  const second = await executeInRoom(value.owner.caller, { command: answer })
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
  await checkpointLiveRoom(value.base.campaign.id)
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
    speedId: null,
    allowances: [expect.objectContaining({ code: 'WALK', budget: 40 })],
    teleport: [],
    fleeSourceActorIds: []
  })
}, 120_000)

it("refuses a player moving a reactor's token, answering the GM's decision, or answering a stale one", async () => {
  const value = await setupAutomaticSceneMovement(twoChoices)
  const [reactorToken] = value.tokens
  if (!reactorToken) throw new Error('Expected a reactor token.')
  // The player controls only the mover; a reactor's token follows its actor's controllers.
  await expect(
    executeSceneInRoom(value.player.caller, {
      ...value.rootInput,
      commandId: crypto.randomUUID(),
      tokenId: value.reactorTokenIds[0]!,
      path: [reactorToken.position, { x: reactorToken.position.x, y: 450 }]
    })
  ).rejects.toThrow()
  const choice = (await executeSceneInRoom(value.owner.caller, value.rootInput)).result?.occurrence
    ?.pending
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
  await expect(executeInRoom(value.player.caller, { command: answer })).rejects.toThrow()
  await expect(
    executeInRoom(value.owner.caller, {
      command: { ...answer, occurrenceId: crypto.randomUUID() }
    })
  ).rejects.toThrow()
  // The refusals committed nothing: the GM's answer still settles the same choice.
  expect((await executeInRoom(value.owner.caller, { command: answer })).occurrence).toMatchObject({
    occurrenceId: choice.occurrenceId
  })
}, 120_000)

it('commits an unbound fog-deriving move under live authority and stages its owner layer', async () => {
  const base = await createSceneDefinitionFixture()
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
    senses: [],
    // A short sight line, so the move explores cells its starting view did not.
    vision: { angleDegrees: 360, brightRange: 0, dimRange: 5, directionDegrees: 0, enabled: true },
    width: 1
  }
  const { sceneId } = await publishScene(base, { tokens: [token] })
  await base.owner.caller.mutation(setPresentation, {
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: null,
    campaignId: base.campaign.id,
    sceneId,
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION'
  })
  await attachFixtureRoom(base.t, base.campaign.id)
  const { result: committed } = await executeSceneInRoom(base.owner.caller, {
    type: 'MOVE_SCENE_TOKEN',
    commandId: crypto.randomUUID(),
    sceneId,
    tokenId: token.id,
    expectedSceneVersion: 0,
    expectedEncounterVersion: null,
    correlationId: null,
    movementKind: 'VOLUNTARY',
    path: [token.position, { x: 900, y: 100 }]
  })
  expect(committed).toMatchObject({
    version: 1,
    delta: { kind: 'TOKEN_MOVED', tokenId: token.id, position: { x: 900, y: 100 } }
  })
  // The room stages the owner's explored layer in the commit's own transaction (D52) and returns no
  // `fogPatches` to the caller, so the REPLACE patch is observable only as the persisted layer below.
  expect((await persisted(base)).sequence).toBe(1)
  const layers = await base.t.run((ctx) =>
    ctx.db
      .query('sceneFogLayers')
      .withIndex('by_sceneId_ownerUserId', (q) => q.eq('sceneId', sceneId))
      .collect()
  )
  expect(layers).toEqual([expect.objectContaining({ ownerUserId: base.other.userId })])
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
  ) => {
    const { result } = await executeSceneInRoom(value.owner.caller, {
      ...value.rootInput,
      commandId: crypto.randomUUID(),
      expectedSceneVersion,
      movementKind,
      path
    })
    if (!result) throw new Error('Expected the move to commit.')
    return result
  }
  const moverMovement = async () => {
    await checkpointLiveRoom(value.base.campaign.id)
    return (
      await value.owner.caller.query(activeState, { campaignId: value.base.campaign.id })
    ).turnMovement.find((entry) => entry.actorId === moverId)
  }
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
  expect(await moverMovement()).toEqual({
    actorId: moverId,
    used: 10,
    speedId: null,
    allowances: [expect.objectContaining({ code: 'WALK', budget: 40 })],
    teleport: [],
    fleeSourceActorIds: []
  })
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
  await checkpointLiveRoom(value.base.campaign.id)
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
it('records the speed type a voluntary move names and refuses an unknown one (SPELLS-5.6)', async () => {
  const value = await setupAutomaticSceneMovement({ reactorPositions: [850, 850] })
  const moverId = value.geometry.actorIdByTokenId.get(value.moverTokenId)!
  const walk = SRD_SPEEDS.find((speed) => speed.code === 'WALK')!
  const path = [
    { x: 150, y: 50 },
    { x: 250, y: 50 }
  ]
  const move = (speedId: string | null, expectedSceneVersion: number, route = path) =>
    executeSceneInRoom(value.owner.caller, {
      ...value.rootInput,
      commandId: crypto.randomUUID(),
      expectedSceneVersion,
      speedId,
      path: route
    })
  const moverMovement = async () => {
    await checkpointLiveRoom(value.base.campaign.id)
    return (
      await value.owner.caller.query(activeState, { campaignId: value.base.campaign.id })
    ).turnMovement.find((entry) => entry.actorId === moverId)
  }
  await expect(move(crypto.randomUUID(), 0)).rejects.toThrow()
  expect(await moverMovement()).toMatchObject({ used: 0, speedId: null })

  const named = await move(walk.id, 0)
  expect(await moverMovement()).toMatchObject({ used: 5, speedId: walk.id })
  // A move that names no speed type keeps the latest named one.
  await move(null, named.result!.version, path.toReversed())
  expect(await moverMovement()).toMatchObject({ used: 10, speedId: walk.id })
}, 120_000)

/** A presented, fog-on Scene with a player's seeing token and one door per state (V03.4, V07.4). */
async function setupPlayerScene() {
  const base = await createSceneDefinitionFixture()
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
    senses: [],
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
  const version = 0
  const { sceneId } = await publishScene(base, {
    barriers: [closed, locked],
    tokens: [scout, sentry]
  })
  await base.owner.caller.mutation(setPresentation, {
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: null,
    campaignId: base.campaign.id,
    sceneId,
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION'
  })
  await attachFixtureRoom(base.t, base.campaign.id)
  const player = async (command: Parameters<typeof executeSceneInRoom>[1]) =>
    (await executeSceneInRoom(base.other.caller, command)).result
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
  // A player acts only on doors their explored fog shows, so the scout steps and explores first.
  const step = await value.player({
    type: 'MOVE_SCENE_TOKEN',
    commandId: crypto.randomUUID(),
    sceneId: value.sceneId,
    tokenId: value.scout.id,
    expectedSceneVersion: value.version,
    expectedEncounterVersion: null,
    correlationId: null,
    movementKind: 'VOLUNTARY',
    path: [value.scout.position, { x: value.scout.position.x + 50, y: value.scout.position.y }]
  })
  expect(step).toMatchObject({ version: value.version + 1 })
  expect(await persisted(value.base)).toMatchObject({ sequence: 1 })
  const readLayers = () =>
    value.base.t.run((ctx) =>
      ctx.db
        .query('sceneFogLayers')
        .withIndex('by_sceneId_ownerUserId', (q) => q.eq('sceneId', value.sceneId))
        .collect()
    )
  const [explored] = await readLayers()
  expect(explored).toMatchObject({ ownerUserId: value.base.other.userId })
  // The player's opened door explores through it: the commit stages the fog as it publishes.
  const committed = await value.player(door(value.closed.id, value.version + 1))
  expect(committed).toMatchObject({
    version: value.version + 2,
    delta: { kind: 'DOOR_STATE_SET', barrierId: value.closed.id, state: 'OPEN' }
  })
  expect(await persisted(value.base)).toMatchObject({ sequence: 2 })
  // Opening the door, with no move between, is what extended the owner's explored layer.
  const layers = await readLayers()
  expect(layers).toEqual([expect.objectContaining({ ownerUserId: value.base.other.userId })])
  expect(layers[0]!.checksum).not.toBe(explored!.checksum)
  expect(layers[0]!.version).toBeGreaterThan(explored!.version)

  // Only the GM changes a locked door; the room refuses the player and nothing advances.
  const refusal = await value.player(door(value.locked.id, value.version + 2)).then(
    () => null,
    (failure: unknown) => failure
  )
  if (!(refusal instanceof RoomCommandRefusal)) throw new Error('Expected a room refusal.')
  expect({ code: refusal.code, message: refusal.message }).toEqual({
    code: 'FORBIDDEN',
    message: 'FORBIDDEN: Only the GM can lock or unlock doors.'
  })
  expect(await persisted(value.base)).toMatchObject({ sequence: 2 })
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
  const committed = await value.player(move(value.scout.id, value.scout.position, value.version))
  expect(committed).toMatchObject({
    version: value.version + 1,
    delta: { kind: 'TOKEN_MOVED', tokenId: value.scout.id, position: { x: 150, y: 100 } }
  })
  expect(await persisted(value.base)).toMatchObject({ sequence: 1 })

  // The player does not control the sentry: the room refuses the move.
  await expect(
    value.player(move(value.sentry.id, value.sentry.position, value.version + 1))
  ).rejects.toThrow()
  expect(await persisted(value.base)).toMatchObject({ sequence: 1 })
}, 120_000)

it('lets the GM give a member control of a Character and take it back, moving that Character token meanwhile (SCENE-5.1)', async () => {
  const value = await setupPlayerScene()
  const { base } = value
  const ready = await readyCharacterFixture({}, undefined, base)
  const { draft, character } = await ready.createCharacter(undefined, base.other.caller)
  await base.other.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  await base.other.caller.mutation(api.campaigns.assignments.assign, {
    campaignId: base.campaign.id,
    characterId: character.id
  })
  const grantee = await createPartyPlayer(base.t, base.campaign)
  await grantee.join()
  const sync = async () => {
    await deliverQueuedRoomControl(base.t)
    await checkpointLiveRoom(base.campaign.id)
  }
  await sync()

  // The GM links the Sentry's token to the Character, as the token inspector does.
  const linked = (
    await executeSceneInRoom(base.owner.caller, {
      type: 'UPSERT_SCENE_TOKEN',
      commandId: crypto.randomUUID(),
      sceneId: value.sceneId,
      expectedSceneVersion: value.version,
      token: { ...value.sentry, characterId: character.id }
    })
  ).result!
  let version = linked.version
  await checkpointLiveRoom(base.campaign.id)
  const move = (userCaller: typeof grantee.caller, from: { x: number; y: number }) =>
    executeSceneInRoom(userCaller, {
      type: 'MOVE_SCENE_TOKEN',
      commandId: crypto.randomUUID(),
      sceneId: value.sceneId,
      tokenId: value.sentry.id,
      expectedSceneVersion: version,
      expectedEncounterVersion: null,
      correlationId: null,
      movementKind: 'VOLUNTARY',
      path: [from, { x: from.x + 50, y: from.y }]
    })
  const grant = (controllerUserIds: string[]) =>
    base.owner.caller.mutation(
      makeFunctionReference<'mutation', Record<string, unknown>, { ok: true }>(
        'campaigns/characterControllers:setControllers'
      ),
      { campaignId: base.campaign.id, characterId: character.id, controllerUserIds }
    )
  let at = value.sentry.position

  // Nobody but the GM and the Character's player controls it yet.
  await expect(move(grantee.caller, at)).rejects.toThrow(/control/)

  await grant([grantee.userId])
  await sync()
  const position = async () => {
    await checkpointLiveRoom(base.campaign.id)
    return base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('sceneLiveEntities')
        .withIndex('by_sceneId_collection_entityId', (q) =>
          q.eq('sceneId', value.sceneId).eq('collection', 'tokens').eq('entityId', value.sentry.id)
        )
        .unique()
      if (row?.value?.collection !== 'tokens') throw new Error('Missing Scene token.')
      return row.value.entity.position
    })
  }
  version = (await move(grantee.caller, at)).version
  expect(await position()).toEqual({ x: at.x + 50, y: at.y })
  at = { x: at.x + 50, y: at.y }

  await grant([])
  await sync()
  await expect(move(grantee.caller, at)).rejects.toThrow(/control/)
  expect(await position()).toEqual(at)
  // The Character's own player keeps control throughout.
  await move(base.other.caller, at)
  expect(await position()).toEqual({ x: at.x + 50, y: at.y })
}, 180_000)
