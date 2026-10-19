import { beforeAll, describe, expect, it, vi } from 'vitest'
import { prepareNativeIncomingDamageGrantTriggers } from '@artificer-toolkit/rules-runtime/encounterActionEffects'
import { prepareEncounterTurnZoneEffects } from '@artificer-toolkit/rules-runtime/encounterTurnZoneEffects'
import { planEncounterMechanicsBatch } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { TurnEffectBoundary } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import {
  CAMPAIGN_ID,
  characterActor,
  createSrdRulesRuntime,
  ENCOUNTER_ID,
  srdCreatureActor,
  srdCreatureTarget,
  SRD_SYSTEM_ID,
  srdDefinitions,
  srdEncounterState,
  testUuid,
  TIMESTAMP
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { splitCharacterPlayState } from '@artificer-toolkit/schema/projections/characterPlayState'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { zoneApplicationKey } from '@artificer-toolkit/shared/vtt'
import { turnCoordinatorRootDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import type { ProjectableCharacterFacts } from '@artificer-toolkit/rules-runtime/encounterActionProjection'
import { buildMovementTarget } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import {
  prepareFixtureSheet,
  readyFighterFixture
} from '@artificer-toolkit/rules-runtime/testing/characterContextFixtures'

import {
  actorIdByTokenId,
  actors,
  AUTO_ROLL,
  authoredZone,
  GM_USER_ID,
  goblin,
  GOBLIN_ID,
  GOBLIN_TOKEN_ID,
  OCCURRENCE_ID,
  placedZone,
  root,
  SCENE_ID,
  source,
  SOURCE_ID,
  START,
  tokens
} from '@artificer-toolkit/rules-runtime/testing/encounterTurnZoneFixture'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encounterRuleUsageUsed,
  withEncounterRuleUsageUsed
} from '@artificer-toolkit/rules-runtime/encounterActorState'
import { SRD_ACTION_ALLOWANCE_DEFINITION_ID as ACTION } from '@artificer-toolkit/source-data/srd/ruleState.js'
import {
  diceDamage,
  failedSaveOnly,
  lostActionOutcome,
  noSave
} from '@artificer-toolkit/rules-runtime/testing/authoredZoneFixture'
import { SRD_DAMAGE_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { createActiveRuleEffectStore } from '../effectStore.js'
import {
  SLEEP_CONDITION_ID,
  sleepEffectOn
} from '@artificer-toolkit/rules-runtime/testing/sleepEffectFixture'
import { SRD, srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import { insertRunActor, readRunActor, readRunActorWithRow, writeRunActor } from '../documents.js'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import {
  persistEncounterMechanicsBatchPlan,
  readEncounterMechanicsBatchTarget
} from '../mechanicsBatchPersistence.js'
import type { EncounterCharacterWriteTransaction } from '../ports.js'
import { createSpatialRuleEffectStore } from '../spatialEffectStore.js'
import { persistEncounterTurnZoneEffects } from '../turnZoneEffectsPersistence.js'

const FIRE = SRD_DAMAGE_TYPES.find((entry) => entry.code === 'FIRE')!.id
const STALE_SELECTION = 'Staged turn zone selection is stale.'
const OCCURRED_AT = '2026-10-17T00:00:00.000Z'
const COMMAND_ID = '00000000-0000-4000-8000-0000000c0001'

const runState = (
  zoneApplications: ReturnType<typeof srdEncounterState>['zoneApplications'] = {},
  { runActors = actors, turnSequence = 3 } = {}
) => ({
  ...srdEncounterState({ actors: runActors, currentActorId: GOBLIN_ID, turnSequence }),
  zoneApplications
})

let runtime: RulesRuntimeService
beforeAll(async () => {
  runtime = createSrdRulesRuntime()
})

/** A memory store holding the Run's actors, its Scene, the goblin's token and the given zones. */
async function seededScene(
  equipment = authoredZone(['START_TURN_IN_SPACE']),
  {
    runActors = actors,
    liveCharacterStreamVersion = 1,
    tokenBindings = new Map([[GOBLIN_TOKEN_ID, GOBLIN_ID]])
  }: {
    runActors?: typeof actors
    liveCharacterStreamVersion?: number
    tokenBindings?: ReadonlyMap<string, string>
  } = {}
) {
  const memory = createMemoryEncounterStore()
  // The only cast: the host ports are the platform, and the wider port surface is unused here.
  // concentrationEnd.test.ts builds its transaction the same way.
  const ctx = {
    db: memory.store,
    ports: {
      requireIdentity: async () => ({ userId: GM_USER_ID }),
      requireCampaignAuthority: async () => ({
        campaign: {
          id: CAMPAIGN_ID,
          status: 'ACTIVE',
          gameSystemId: SRD_SYSTEM_ID,
          ownerUserId: GM_USER_ID
        }
      }),
      readCharacterRow: async () => ({
        status: 'ACTIVE',
        systemId: SRD_SYSTEM_ID,
        play: { streamVersion: liveCharacterStreamVersion }
      })
    }
  } as unknown as EncounterCharacterWriteTransaction
  const run = encounterRunStateSchema.parse(runState({}, { runActors }))
  await memory.store.insert('encounterRuns', {
    id: run.id,
    campaignId: run.campaignId,
    gameSystemId: run.gameSystemId,
    status: run.status,
    version: run.version,
    stateJson: JSON.stringify(run),
    stateChecksum: checksumCanonicalJson(run),
    createCommandId: COMMAND_ID,
    createCommandFingerprint: 'b'.repeat(64),
    concentrationCasterCharacterIds: [],
    createdAt: OCCURRED_AT,
    updatedAt: OCCURRED_AT
  })
  for (const actor of runActors) await insertRunActor(ctx, actor)
  await memory.store.insert('encounterSceneBindings', {
    encounterId: ENCOUNTER_ID,
    campaignId: CAMPAIGN_ID,
    sceneId: SCENE_ID,
    commandId: COMMAND_ID,
    commandFingerprint: 'a'.repeat(64),
    createdAt: OCCURRED_AT
  })
  for (const [tokenId, actorId] of tokenBindings)
    await memory.store.insert('encounterActorTokenBindings', {
      actorId,
      encounterId: ENCOUNTER_ID,
      sceneId: SCENE_ID,
      tokenId
    })
  const scope = await createSpatialRuleEffectStore(ctx).scope({
    encounterId: ENCOUNTER_ID,
    sceneId: SCENE_ID
  })
  if (!scope) throw new Error('The Scene must be bound.')
  const { id, definition, lifecycle, placement, spatialState } = placedZone(0x3a1, equipment, 1)
  const zone = await scope.create({ id, definition, lifecycle, placement, spatialState })
  return { ctx, scope, zone }
}

/** The staged plan the turn preparation makes against the stored Scene, from real product code. */
async function stagedPlan(
  scene: Awaited<ReturnType<typeof seededScene>>,
  {
    state = runState(),
    runActors = actors,
    turnRoot = root,
    boundary = START,
    random = () => 0,
    loadTarget = async (actorId) =>
      srdCreatureTarget(runActors.find((actor) => actor.id === actorId)!),
    sceneTokens = tokens,
    sceneBindings = actorIdByTokenId
  }: {
    state?: ReturnType<typeof runState>
    runActors?: typeof actors
    turnRoot?: typeof root
    boundary?: TurnEffectBoundary
    random?: (maxExclusive: number) => number
    loadTarget?: Parameters<typeof prepareEncounterTurnZoneEffects>[0]['loadTarget']
    sceneTokens?: typeof tokens
    sceneBindings?: typeof actorIdByTokenId
  } = {}
) {
  const prepared = await prepareEncounterTurnZoneEffects({
    state,
    userId: GM_USER_ID,
    root: turnRoot,
    occurrenceId: OCCURRENCE_ID,
    actors: runActors,
    boundary,
    loadScene: async () => ({
      effects: await scene.scope.list(),
      tokens: sceneTokens,
      actorIdByTokenId: sceneBindings
    }),
    loadTarget,
    createRuntime: async () => runtime,
    definitions: srdDefinitions,
    random,
    autoRollByActorId: AUTO_ROLL
  })
  if (prepared.kind !== 'COMPLETE' || !prepared.plan) throw new Error('Expected a staged plan.')
  return prepared.plan
}

type Plan = Awaited<ReturnType<typeof stagedPlan>>

type Callbacks = Parameters<typeof persistEncounterTurnZoneEffects>[2]

/** The room's mechanics batch for a creature target: read, plan and persist over the same store. */
function settleMechanicsBatch(ctx: EncounterCharacterWriteTransaction) {
  return async (batch: Parameters<Callbacks['applyMechanics']>[0]) => {
    const target = await readEncounterMechanicsBatchTarget(ctx, {
      ...batch,
      expectedCharacterStreamVersion: null
    })
    const plan = planEncounterMechanicsBatch({
      batch: target.input,
      actor: target.actor,
      userId: target.userId
    })
    return persistEncounterMechanicsBatchPlan(ctx, target, {
      actor: target.actor,
      character: null,
      plan
    })
  }
}

function persist(
  scene: Awaited<ReturnType<typeof seededScene>>,
  input: {
    plan: Plan | undefined
    commandType?: 'START' | 'ADVANCE_TURN'
    boundary?: TurnEffectBoundary
    state?: ReturnType<typeof runState>
    readSceneTokens?: () => Promise<typeof tokens>
  }
) {
  const applyMechanics = vi.fn(settleMechanicsBatch(scene.ctx))
  const result = persistEncounterTurnZoneEffects(
    scene.ctx,
    {
      state: input.state ?? runState(),
      occurrenceId: OCCURRENCE_ID,
      rootCommandId: root.rootCommandId,
      commandType: input.commandType ?? 'ADVANCE_TURN',
      occurredAt: OCCURRED_AT,
      boundary: input.boundary ?? START,
      plan: input.plan
    },
    { applyMechanics, readSceneTokens: input.readSceneTokens ?? (async () => tokens) }
  )
  return { result, applyMechanics }
}

/** The goblin is a creature, whose hit points live on the actor itself. */
function creature(actor: EncounterRunActorState) {
  if (actor.kind === 'CHARACTER') throw new Error('Expected a creature actor.')
  return actor
}

describe('persisting a turn zone phase inside the terminal transaction (SPELLS-20 T4b2b2)', () => {
  it('commits a plan prepared against the Scene and returns the executed phase', async () => {
    const scene = await seededScene()
    const plan = await stagedPlan(scene)
    const { result, applyMechanics } = persist(scene, { plan })

    const settled = await result
    expect(applyMechanics).toHaveBeenCalledTimes(1)
    expect(applyMechanics.mock.calls[0]![0]).toMatchObject({
      encounterId: ENCOUNTER_ID,
      targetActorId: GOBLIN_ID,
      expectedEncounterVersion: 7,
      occurrenceId: OCCURRENCE_ID,
      forceVersionAdvance: false
    })
    expect(settled?.phase).toMatchObject({
      kind: 'EXECUTED',
      selectionChecksum: plan.selectionChecksum,
      characterTransitions: []
    })
    expect(settled?.phase.executions).toHaveLength(1)
    expect(settled?.phase.executions[0]).toMatchObject({
      ordinal: 0,
      candidate: { boundaryOrdinal: START.ordinal, candidate: { effectId: scene.zone.id } }
    })
    // The phase reports what the real batch persisted, not what the plan predicted.
    const stored = creature(await readRunActor(scene.ctx, runState(), GOBLIN_ID))
    expect(stored.currentHitPoints).toBeLessThan(creature(goblin).currentHitPoints)
    expect(settled?.actors).toEqual([stored])
    expect(settled?.phase.encounterActorTransitions).toEqual([
      {
        targetActorId: GOBLIN_ID,
        before: expect.objectContaining({ currentHitPoints: creature(goblin).currentHitPoints }),
        after: expect.objectContaining({ currentHitPoints: stored.currentHitPoints })
      }
    ])
  })

  it('deletes the sleep the zone’s damage ends and releases the condition it held (SPELLS-33.T6e4)', async () => {
    const asleep = srdCreatureActor({
      id: GOBLIN_ID,
      creature: srdByLabel(SRD.creatures, 'Goblin'),
      conditionIds: [SLEEP_CONDITION_ID]
    })
    const runActors = [asleep, source]
    const scene = await seededScene(undefined, { runActors })
    const store = createActiveRuleEffectStore(scene.ctx)
    const sleeper = sleepEffectOn({
      encounterId: ENCOUNTER_ID,
      id: testUuid(0x3d1),
      sourceActorId: SOURCE_ID,
      holder: asleep
    })
    await store.create({
      id: sleeper.id,
      owner: sleeper.owner,
      definition: sleeper.definition,
      lifecycle: sleeper.lifecycle
    })
    const plan = await stagedPlan(scene, {
      runActors,
      state: runState({}, { runActors }),
      loadTarget: async (actorId) =>
        srdCreatureTarget(
          runActors.find((actor) => actor.id === actorId)!,
          actorId === GOBLIN_ID ? await store.list(sleeper.owner) : []
        )
    })
    const { result } = persist(scene, { plan, state: runState({}, { runActors }) })
    const settled = await result

    expect(await store.list(sleeper.owner)).toEqual([])
    const stored = creature(await readRunActor(scene.ctx, runState(), GOBLIN_ID))
    expect(stored.conditions).toEqual([])
    expect(settled?.phase.encounterActorTransitions[0]?.after.conditionIds).toEqual([])
  })

  it('gives the timed grant the creature’s passive trigger owes the zone’s fire (SPELLS-33.T6e3b)', async () => {
    const golem = srdCreatureActor({
      id: GOBLIN_ID,
      creature: srdByLabel(SRD.creatures, 'Flesh Golem')
    })
    const runActors = [golem, source]
    const scene = await seededScene(
      authoredZone(['START_TURN_IN_SPACE'], undefined, {}, (parts) =>
        diceDamage('1d4', (damage) => {
          damage.damageTypeId = FIRE
        })(parts)
      ),
      { runActors }
    )
    const plan = await stagedPlan(scene, {
      runActors,
      state: runState({}, { runActors })
    })
    const { result } = persist(scene, { plan, state: runState({}, { runActors }) })
    await result

    const held = await createActiveRuleEffectStore(scene.ctx).list({
      kind: 'ENCOUNTER_ACTOR',
      encounterId: ENCOUNTER_ID,
      targetActorId: GOBLIN_ID
    })
    const [trigger] = prepareNativeIncomingDamageGrantTriggers({
      encounter: runState({}, { runActors }),
      holder: golem,
      held: [],
      occurrenceId: OCCURRENCE_ID,
      commandId: root.rootCommandId,
      ordinal: 'TURN_ZONE_EFFECT',
      activeEffectsByActorId: new Map()
    })
    expect(held.map(({ id, definition }) => [id, definition.authoredEffectId])).toEqual([
      [trigger!.id, trigger!.authoredEffectId]
    ])
  })

  it('gives a creature without the passive trigger no grant from the zone’s fire (SPELLS-33.T6e3b)', async () => {
    const scene = await seededScene(
      authoredZone(['START_TURN_IN_SPACE'], undefined, {}, (parts) =>
        diceDamage('1d4', (damage) => {
          damage.damageTypeId = FIRE
        })(parts)
      )
    )
    const plan = await stagedPlan(scene)
    await persist(scene, { plan }).result

    expect(
      await createActiveRuleEffectStore(scene.ctx).list({
        kind: 'ENCOUNTER_ACTOR',
        encounterId: ENCOUNTER_ID,
        targetActorId: GOBLIN_ID
      })
    ).toEqual([])
  })

  it('refuses a plan made before the creature left the zone, without settling', async () => {
    const scene = await seededScene()
    const plan = await stagedPlan(scene)
    const moved = tokens.map((token) =>
      token.id === GOBLIN_TOKEN_ID ? { ...token, position: { x: 2000, y: 2000 } } : token
    )
    const { result, applyMechanics } = persist(scene, {
      plan,
      readSceneTokens: async () => moved
    })

    await expect(result).rejects.toThrow(STALE_SELECTION)
    expect(applyMechanics).not.toHaveBeenCalled()
  })

  it('refuses a plan made before the zone’s per-turn limit was spent, without settling', async () => {
    const scene = await seededScene(authoredZone(['START_TURN_IN_SPACE'], 1))
    const plan = await stagedPlan(scene)
    // The incoming turn is sequence 4; an application counted for it is spent.
    const spent = runState({
      [zoneApplicationKey(scene.zone.id, GOBLIN_ID)]: { turnSequence: 4, count: 1 }
    })
    const { result, applyMechanics } = persist(scene, { plan, state: spent })

    await expect(result).rejects.toThrow(STALE_SELECTION)
    expect(applyMechanics).not.toHaveBeenCalled()
  })

  it('refuses a plan made before its zone was edited, without settling', async () => {
    const scene = await seededScene()
    const plan = await stagedPlan(scene)
    await scene.scope.updateCurrentStateCas({
      id: scene.zone.id,
      expectedVersion: scene.zone.version,
      lifecycle: scene.zone.lifecycle,
      spatialState: scene.zone.spatialState
    })
    const { result, applyMechanics } = persist(scene, { plan })

    await expect(result).rejects.toThrow(STALE_SELECTION)
    expect(applyMechanics).not.toHaveBeenCalled()
  })

  it('refuses a plan when no zone catches the creature any more, without settling', async () => {
    const scene = await seededScene()
    const plan = await stagedPlan(scene)
    await scene.scope.deleteCas({ id: scene.zone.id, expectedVersion: scene.zone.version })
    const { result, applyMechanics } = persist(scene, { plan })

    await expect(result).rejects.toThrow(STALE_SELECTION)
    expect(applyMechanics).not.toHaveBeenCalled()
  })

  it('returns null, without settling, when neither a plan nor a contact exists', async () => {
    const scene = await seededScene()
    await scene.scope.deleteCas({ id: scene.zone.id, expectedVersion: scene.zone.version })
    const { result, applyMechanics } = persist(scene, { plan: undefined })

    await expect(result).resolves.toBeNull()
    expect(applyMechanics).not.toHaveBeenCalled()
  })

  it('lets the real mechanics batch refuse a plan made before the creature was hurt, persisting nothing', async () => {
    const scene = await seededScene()
    const plan = await stagedPlan(scene)
    const { row, actor: read } = await readRunActorWithRow(scene.ctx, runState(), GOBLIN_ID)
    const actor = creature(read)
    await writeRunActor(scene.ctx, row._id, {
      ...actor,
      currentHitPoints: actor.currentHitPoints - 1
    })
    const { result, applyMechanics } = persist(scene, { plan })

    await expect(result).rejects.toThrow('The Character rule action application order is stale.')
    expect(applyMechanics).toHaveBeenCalledTimes(1)
    expect(creature(await readRunActor(scene.ctx, runState(), GOBLIN_ID)).currentHitPoints).toBe(
      actor.currentHitPoints - 1
    )
  })

  describe('for a zone outcome with no save at its source’s turn (SPELLS-20 T6a, D144)', () => {
    // A second goblin whose id sorts before the first; both stand in the zone with its source.
    const OTHER_ID = testUuid(0x300)
    const OTHER_TOKEN_ID = testUuid(0x30a)
    const other = encounterRunActorStateSchema.parse({ ...goblin, id: OTHER_ID })
    const crowd = [goblin, source, other]
    const crowdTokens = [
      tokens[0]!,
      { ...tokens[1]!, position: tokens[0]!.position },
      { ...tokens[0]!, id: OTHER_TOKEN_ID }
    ]
    const crowdBindings = new Map([...actorIdByTokenId, [OTHER_TOKEN_ID, OTHER_ID]])
    const SOURCE_START = { ...START, actorId: SOURCE_ID }

    it('settles one mechanics batch per creature it caught, ordered by actorId, and returns each', async () => {
      const state = runState({}, { runActors: crowd })
      const scene = await seededScene(
        authoredZone([], undefined, {}, (parts) => noSave()(parts)),
        { runActors: crowd, tokenBindings: crowdBindings }
      )
      const plan = await stagedPlan(scene, {
        state,
        runActors: crowd,
        boundary: SOURCE_START,
        sceneTokens: crowdTokens,
        sceneBindings: crowdBindings
      })
      const { result, applyMechanics } = persist(scene, {
        plan,
        state,
        boundary: SOURCE_START,
        readSceneTokens: async () => crowdTokens
      })

      const settled = await result
      expect(applyMechanics.mock.calls.map(([batch]) => batch.targetActorId)).toEqual([
        OTHER_ID,
        GOBLIN_ID
      ])
      const stored = await Promise.all(
        [OTHER_ID, GOBLIN_ID].map(async (id) => creature(await readRunActor(scene.ctx, state, id)))
      )
      for (const actor of stored)
        expect(actor.currentHitPoints).toBe(creature(goblin).currentHitPoints - 1)
      expect(settled?.actors).toEqual(stored)
      expect(
        settled?.phase.encounterActorTransitions.map(({ targetActorId }) => targetActorId)
      ).toEqual([OTHER_ID, GOBLIN_ID])
      expect(creature(await readRunActor(scene.ctx, state, SOURCE_ID)).currentHitPoints).toBe(
        creature(source).currentHitPoints
      )
    })
  })

  describe('for a zone whose failed save costs the Action (SPELLS-20 T4b3b, D141)', () => {
    const lostAction = () =>
      authoredZone(['START_TURN_IN_SPACE'], undefined, {}, failedSaveOnly(lostActionOutcome()))

    it('spends the Action the plan names on the stored actor and returns it', async () => {
      const scene = await seededScene(lostAction())
      const plan = await stagedPlan(scene)
      expect(plan.executions[0]?.actionEconomy).toMatchObject({ beforeUsed: 0, afterUsed: 1 })
      const settled = await persist(scene, { plan }).result

      const stored = await readRunActor(scene.ctx, runState(), GOBLIN_ID)
      expect(encounterRuleUsageUsed(stored, ACTION)).toBe(1)
      expect(settled?.actors).toEqual([stored])
      expect(settled?.phase.executions[0]?.actionEconomy).toEqual(plan.executions[0]?.actionEconomy)
    })

    it('refuses a lost Action staged for a zone that does not cost one, without settling', async () => {
      const lostActionPlan = await stagedPlan(await seededScene(lostAction()))
      const scene = await seededScene()
      const plan = await stagedPlan(scene)
      const forged = {
        ...plan,
        executions: plan.executions.map((execution) => ({
          ...execution,
          actionEconomy: lostActionPlan.executions[0]!.actionEconomy
        }))
      }
      const { result, applyMechanics } = persist(scene, { plan: forged })

      await expect(result).rejects.toThrow('Staged turn zone action economy is stale.')
      expect(applyMechanics).not.toHaveBeenCalled()
    })

    it('refuses a plan made before the creature spent its Action', async () => {
      const scene = await seededScene(lostAction())
      const plan = await stagedPlan(scene)
      const { row, actor } = await readRunActorWithRow(scene.ctx, runState(), GOBLIN_ID)
      await writeRunActor(
        scene.ctx,
        row._id,
        encounterRunActorStateSchema.parse({
          ...actor,
          resources: withEncounterRuleUsageUsed(actor, ACTION, 1)
        })
      )

      await expect(persist(scene, { plan }).result).rejects.toThrow(
        'The selected action allowance changed before settlement.'
      )
    })
  })

  describe('on the START command', () => {
    const startRoot = turnCoordinatorRootDtoSchema.parse({ ...root, commandType: 'START' })
    // The first turn: the Run has not advanced yet, so the incoming turn is sequence 1.
    const incoming: TurnEffectBoundary = { ordinal: 0, stage: 'START_OF_TURN', actorId: GOBLIN_ID }
    const fresh = runState({}, { turnSequence: 0 })

    it('commits the incoming-boundary plan of the first creature standing in a zone', async () => {
      const scene = await seededScene()
      const plan = await stagedPlan(scene, {
        state: fresh,
        turnRoot: startRoot,
        boundary: incoming
      })
      const { result, applyMechanics } = persist(scene, {
        plan,
        state: fresh,
        commandType: 'START',
        boundary: incoming
      })

      const settled = await result
      expect(applyMechanics).toHaveBeenCalledTimes(1)
      expect(settled?.phase).toMatchObject({
        kind: 'EXECUTED',
        selectionChecksum: plan.selectionChecksum
      })
      expect(settled?.phase.executions[0]).toMatchObject({
        candidate: {
          boundaryOrdinal: incoming.ordinal,
          candidate: { effectId: scene.zone.id, trigger: 'START_OF_TURN' }
        }
      })
    })

    it('refuses a plan staged for an ADVANCE_TURN command, without settling', async () => {
      const scene = await seededScene()
      const plan = await stagedPlan(scene, { state: fresh, boundary: incoming })
      const { result, applyMechanics } = persist(scene, {
        plan,
        state: fresh,
        commandType: 'START',
        boundary: incoming
      })

      await expect(result).rejects.toThrow(STALE_SELECTION)
      expect(applyMechanics).not.toHaveBeenCalled()
    })
  })

  describe('for a Character target', () => {
    it('refuses a plan whose Character stream version moved since planning, without settling', async () => {
      const fixture = readyFighterFixture()
      const sheet = await prepareFixtureSheet(fixture)
      const hero = characterActor({ id: GOBLIN_ID, characterId: fixture.character.id })
      const runActors = [hero, source]
      const document = sheet.prepared.character
      const split = splitCharacterPlayState({
        state: document.state,
        sheetState: sheet.sheetState
      })
      // The stored form carries no `undefined` members.
      const json = <T>(value: T): T => JSON.parse(JSON.stringify(value))
      const structure = json({ ...document, state: split.structure.state })
      const sheetStructure = json(split.structure.sheetState)
      const play = json(split.play)
      const characterFacts: ProjectableCharacterFacts = {
        active: {
          id: document.id,
          userId: document.userId,
          systemId: document.systemId,
          label: document.label,
          status: document.status ?? 'ACTIVE',
          documentJson: canonicalizeRuleDocument(structure),
          checksum: checksumRuleDocument(structure),
          updatedAt: TIMESTAMP,
          sheetState: {
            documentJson: canonicalizeRuleDocument(sheetStructure),
            checksum: checksumRuleDocument(sheetStructure)
          },
          play: {
            characterId: document.id,
            userId: document.userId,
            streamVersion: 1,
            state: play,
            checksum: checksumRuleDocument(play),
            updatedAt: TIMESTAMP,
            maximumHitPoints: 12
          }
        },
        character: fixture.character,
        campaignContext: { conditions: [], adjustments: [], attunementSlotOverride: null },
        prepared: sheet.prepared,
        ruleEvaluation: sheet.ruleEvaluation,
        sheetState: sheet.sheetState,
        evaluationInput: sheet.evaluationInput
      }
      const state = runState({}, { runActors })
      const planning = await seededScene(authoredZone(['START_TURN_IN_SPACE']), { runActors })
      const plan = await stagedPlan(planning, {
        state,
        runActors,
        // A natural 20 passes the save, so the zone leaves the Character unchanged.
        random: (maxExclusive) => maxExclusive - 1,
        loadTarget: async () =>
          buildMovementTarget<ProjectableCharacterFacts>({
            actor: hero,
            activeEffects: [],
            characterFacts,
            campaignId: CAMPAIGN_ID,
            gameSystemId: SRD_SYSTEM_ID
          })
      })

      const moved = await seededScene(authoredZone(['START_TURN_IN_SPACE']), {
        runActors,
        liveCharacterStreamVersion: 2
      })
      const { result, applyMechanics } = persist(moved, { plan, state })

      await expect(result).rejects.toThrow('Staged turn zone target pin is stale.')
      expect(applyMechanics).not.toHaveBeenCalled()
    })
  })
})
