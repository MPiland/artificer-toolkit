import { beforeAll, describe, expect, it, vi } from 'vitest'
import { prepareEncounterTurnZoneEffects } from '@artificer-toolkit/rules-runtime/encounterTurnZoneEffects'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import {
  CAMPAIGN_ID,
  createSrdRulesRuntime,
  ENCOUNTER_ID,
  srdCreatureTarget,
  srdEncounterState
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { zoneApplicationKey } from '@artificer-toolkit/shared/vtt'

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
  START,
  tokens
} from '../../../rules-runtime/src/__tests__/encounterTurnZoneFixture.js'
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
  zoneApplications: ReturnType<typeof srdEncounterState>['zoneApplications'] = {}
) => ({
  ...srdEncounterState({ actors, currentActorId: GOBLIN_ID, turnSequence: 3 }),
  zoneApplications
})

let runtime: RulesRuntimeService
beforeAll(async () => {
  runtime = await createSrdRulesRuntime()
})

/** A memory store holding the Run's actors, its Scene, the goblin's token and the given zones. */
async function seededScene(equipment = authoredZone(['START_TURN_IN_SPACE'])) {
  const memory = createMemoryEncounterStore()
  const ctx = { db: memory.store } as unknown as EncounterCharacterWriteTransaction
  for (const actor of actors) await insertRunActor(ctx, actor)
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
  state: ReturnType<typeof runState> = runState()
) {
  const prepared = await prepareEncounterTurnZoneEffects({
    state,
    userId: GM_USER_ID,
    root,
    occurrenceId: OCCURRENCE_ID,
    actors,
    boundary: START,
    loadScene: async () => ({ effects: await scene.scope.list(), tokens, actorIdByTokenId }),
    loadTarget: async (actorId) => srdCreatureTarget(actors.find((actor) => actor.id === actorId)!),
    createRuntime: async () => runtime,
    random: () => 0,
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
      commandType: 'ADVANCE_TURN',
      occurredAt: OCCURRED_AT,
      boundary: START,
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
})
