import { beforeAll, describe, expect, it, vi } from 'vitest'
import { prepareEncounterTurnZoneEffects } from '@artificer-toolkit/rules-runtime/encounterTurnZoneEffects'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import type { TurnEffectBoundary } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import {
  CAMPAIGN_ID,
  characterActor,
  createSrdRulesRuntime,
  ENCOUNTER_ID,
  srdCreatureTarget,
  SRD_SYSTEM_ID,
  srdEncounterState,
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
  GOBLIN_ID,
  GOBLIN_TOKEN_ID,
  OCCURRENCE_ID,
  placedZone,
  root,
  SCENE_ID,
  source,
  START,
  tokens
} from '@artificer-toolkit/rules-runtime/testing/encounterTurnZoneFixture'
import { insertRunActor } from '../documents.js'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import type { EncounterMechanicsBatchResult } from '../mechanicsBatchPersistence.js'
import type { EncounterCharacterWriteTransaction } from '../ports.js'
import { createSpatialRuleEffectStore } from '../spatialEffectStore.js'
import type { EncounterDocument } from '../store.js'
import { persistEncounterTurnZoneEffects } from '../turnZoneEffectsPersistence.js'

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
  runtime = await createSrdRulesRuntime()
})

/** A memory store holding the Run's actors, its Scene, the goblin's token and the given zones. */
async function seededScene(
  equipment = authoredZone(['START_TURN_IN_SPACE']),
  { runActors = actors, ports = {} }: { runActors?: typeof actors; ports?: object } = {}
) {
  const memory = createMemoryEncounterStore()
  const ctx = { db: memory.store, ports } as unknown as EncounterCharacterWriteTransaction
  for (const actor of runActors) await insertRunActor(ctx, actor)
  memory.load('encounterSceneBindings', [
    {
      _id: 'scene-binding',
      _creationTime: 1,
      encounterId: ENCOUNTER_ID,
      campaignId: CAMPAIGN_ID,
      sceneId: SCENE_ID,
      commandId: COMMAND_ID,
      commandFingerprint: 'a'.repeat(64),
      createdAt: OCCURRED_AT
    }
  ] as unknown as EncounterDocument<'encounterSceneBindings'>[])
  memory.load('encounterActorTokenBindings', [
    {
      _id: 'token-binding',
      _creationTime: 2,
      actorId: GOBLIN_ID,
      encounterId: ENCOUNTER_ID,
      sceneId: SCENE_ID,
      tokenId: GOBLIN_TOKEN_ID
    }
  ] as unknown as EncounterDocument<'encounterActorTokenBindings'>[])
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
    loadTarget = async (actorId) => srdCreatureTarget(actors.find((actor) => actor.id === actorId)!)
  }: {
    state?: ReturnType<typeof runState>
    runActors?: typeof actors
    turnRoot?: typeof root
    boundary?: TurnEffectBoundary
    random?: (maxExclusive: number) => number
    loadTarget?: Parameters<typeof prepareEncounterTurnZoneEffects>[0]['loadTarget']
  } = {}
) {
  const prepared = await prepareEncounterTurnZoneEffects({
    state,
    userId: GM_USER_ID,
    root: turnRoot,
    occurrenceId: OCCURRENCE_ID,
    actors: runActors,
    boundary,
    loadScene: async () => ({ effects: await scene.scope.list(), tokens, actorIdByTokenId }),
    loadTarget,
    createRuntime: async () => runtime,
    random,
    autoRollByActorId: AUTO_ROLL
  })
  if (prepared.kind !== 'COMPLETE' || !prepared.plan) throw new Error('Expected a staged plan.')
  return prepared.plan
}

type Plan = Awaited<ReturnType<typeof stagedPlan>>

/** What the mechanics batch would settle: the plan's own transitions and applications. */
function settledFrom(plan: Plan) {
  let ordinal = 0
  return {
    updatedActor: actors[0]!,
    receiptApplications: plan.executions.flatMap((execution) =>
      execution.applications.map((application) => ({ ...application, ordinal: ordinal++ }))
    ),
    targetTransition: {
      checksum: plan.executions.at(-1)!.targetTransition.checksum,
      before: plan.executions[0]!.targetTransition.before,
      after: plan.executions.at(-1)!.targetTransition.after
    },
    characterStreamVersion: null,
    itemUseStateTransition: null,
    endedGrants: []
  } as unknown as EncounterMechanicsBatchResult
}

function persist(
  scene: Awaited<ReturnType<typeof seededScene>>,
  input: {
    plan: Plan | undefined
    commandType?: 'START' | 'ADVANCE_TURN'
    boundary?: TurnEffectBoundary
    state?: ReturnType<typeof runState>
    readSceneTokens?: () => Promise<typeof tokens>
    settle?: (plan: Plan) => EncounterMechanicsBatchResult
  }
) {
  const applyMechanics = vi.fn(async (_batch: Record<string, unknown>) =>
    input.settle!(input.plan!)
  )
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

describe('persisting a turn zone phase inside the terminal transaction (SPELLS-20 T4b2b2)', () => {
  it('commits a plan prepared against the Scene and returns the executed phase', async () => {
    const scene = await seededScene()
    const plan = await stagedPlan(scene)
    const { result, applyMechanics } = persist(scene, { plan, settle: settledFrom })

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
    expect(settled?.phase.encounterActorTransitions).toHaveLength(1)
  })

  it('refuses a plan made before the creature left the zone, without settling', async () => {
    const scene = await seededScene()
    const plan = await stagedPlan(scene)
    const moved = tokens.map((token) =>
      token.id === GOBLIN_TOKEN_ID ? { ...token, position: { x: 2000, y: 2000 } } : token
    )
    const { result, applyMechanics } = persist(scene, {
      plan,
      settle: settledFrom,
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
    const { result, applyMechanics } = persist(scene, { plan, settle: settledFrom, state: spent })

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
    const { result, applyMechanics } = persist(scene, { plan, settle: settledFrom })

    await expect(result).rejects.toThrow(STALE_SELECTION)
    expect(applyMechanics).not.toHaveBeenCalled()
  })

  it('refuses a plan when no zone catches the creature any more, without settling', async () => {
    const scene = await seededScene()
    const plan = await stagedPlan(scene)
    await scene.scope.deleteCas({ id: scene.zone.id, expectedVersion: scene.zone.version })
    const { result, applyMechanics } = persist(scene, { plan, settle: settledFrom })

    await expect(result).rejects.toThrow(STALE_SELECTION)
    expect(applyMechanics).not.toHaveBeenCalled()
  })

  it('returns null, without settling, when neither a plan nor a contact exists', async () => {
    const scene = await seededScene()
    await scene.scope.deleteCas({ id: scene.zone.id, expectedVersion: scene.zone.version })
    const { result, applyMechanics } = persist(scene, { plan: undefined, settle: settledFrom })

    await expect(result).resolves.toBeNull()
    expect(applyMechanics).not.toHaveBeenCalled()
  })

  it('refuses a settlement that differs from its plan', async () => {
    const scene = await seededScene()
    const plan = await stagedPlan(scene)
    const { result } = persist(scene, {
      plan,
      settle: (staged) => {
        const settled = settledFrom(staged)
        return {
          ...settled,
          targetTransition: {
            ...settled.targetTransition,
            after: { ...settled.targetTransition.after, currentHitPoints: 0 }
          }
        }
      }
    })

    await expect(result).rejects.toThrow('Turn zone settlement differs from its plan.')
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
        boundary: incoming,
        settle: settledFrom
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
        boundary: incoming,
        settle: settledFrom
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
      const characterFacts = {
        active: {
          id: document.id,
          userId: document.userId,
          systemId: document.systemId,
          label: document.label,
          status: document.status,
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
        character: sheet.prepared.character,
        campaignContext: { conditions: [], adjustments: [], attunementSlotOverride: null },
        prepared: sheet.prepared,
        ruleEvaluation: sheet.ruleEvaluation,
        sheetState: sheet.sheetState,
        evaluationInput: sheet.evaluationInput
      } as unknown as ProjectableCharacterFacts
      const liveStreamVersion = (streamVersion: number) => ({
        readCharacterRow: async () => ({
          status: 'ACTIVE',
          systemId: SRD_SYSTEM_ID,
          play: { streamVersion }
        })
      })
      const state = runState({}, { runActors })
      const planning = await seededScene(authoredZone(['START_TURN_IN_SPACE']), {
        runActors,
        ports: liveStreamVersion(1)
      })
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
        ports: liveStreamVersion(2)
      })
      const { result, applyMechanics } = persist(moved, { plan, state, settle: settledFrom })

      await expect(result).rejects.toThrow('Staged turn zone target pin is stale.')
      expect(applyMechanics).not.toHaveBeenCalled()
    })
  })
})
