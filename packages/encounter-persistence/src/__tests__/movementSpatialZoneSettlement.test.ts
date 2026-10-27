import { describe, expect, it } from 'vitest'
import { spatialEffectTransition } from '@artificer-toolkit/rules-runtime/encounterSpatialMovementEffects'
import type { ProjectableCharacterFacts } from '@artificer-toolkit/rules-runtime/encounterActionProjection'
import {
  prepareEncounterSpatialMovement,
  projectPreparedSpatialMovementReceipt,
  type PreparedSpatialMovementPlan
} from '@artificer-toolkit/rules-runtime/encounterSpatialMovementPreparation'
import {
  CAMPAIGN_ID,
  createSrdRulesRuntime,
  ENCOUNTER_ID,
  srdCreatureTarget,
  srdEncounterState,
  testUuid
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
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
  SCENE_ID,
  tokens
} from '@artificer-toolkit/rules-runtime/testing/encounterTurnZoneFixture'
import { liveSessionMovementSettlementSchema } from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import { sceneStoredGeometrySaveSchema } from '@artificer-toolkit/schema/projections/sceneGeometryPersistence'
import { sceneSpatialPreparationSchema } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'

import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import { persistMovementSettlements } from '../movementSettlementPersistence.js'
import type { EncounterCharacterWriteTransaction } from '../ports.js'
import { createSpatialRuleEffectStore } from '../spatialEffectStore.js'

/**
 * A movement's retained spatial contact settles against the zone row as it stands when the
 * movement commits: a zone that ended or was deleted after the contact was planned refuses the
 * commit, and nothing is written. The contact is planned by the real spatial planner.
 */

const COMMAND_ID = testUuid(0xd01)
const OCCURRED_AT = '2026-10-17T00:00:00.000Z'
const START_POINT = { x: 50, y: 350 }
const ENTERING_PATH = [START_POINT, { x: 250, y: 350 }]

const unreachable = async (): Promise<never> => {
  throw new Error('The zone must be gone before any contact settles.')
}

async function plannedMovementThroughZone() {
  const memory = createMemoryEncounterStore()
  await memory.store.insert('encounterSceneBindings', {
    encounterId: ENCOUNTER_ID,
    campaignId: CAMPAIGN_ID,
    sceneId: SCENE_ID,
    commandId: COMMAND_ID,
    commandFingerprint: 'a'.repeat(64),
    createdAt: OCCURRED_AT
  })
  // The host ports are the platform and are unused on this path.
  const ctx = { db: memory.store, ports: {} } as unknown as EncounterCharacterWriteTransaction
  const scope = await createSpatialRuleEffectStore(ctx).scope({
    encounterId: ENCOUNTER_ID,
    sceneId: SCENE_ID
  })
  if (!scope) throw new Error('The Scene must be bound.')
  const { id, definition, lifecycle, placement, spatialState } = placedZone(
    0x3a1,
    authoredZone(['ENTER_SPACE']),
    1
  )
  const zone = await scope.create({ id, definition, lifecycle, placement, spatialState })

  const state = srdEncounterState({ actors, currentActorId: GOBLIN_ID, turnSequence: 3 })
  const settled: PreparedSpatialMovementPlan<ProjectableCharacterFacts>[] = []
  const prepared = await prepareEncounterSpatialMovement({
    actors,
    input: {
      autoRoll: AUTO_ROLL,
      sceneId: SCENE_ID,
      sceneVersion: 1,
      sceneGrid: {
        kind: 'SQUARE',
        cellSize: 100,
        diagonalPolicy: 'EQUAL',
        distancePerCell: 5,
        origin: { x: 0, y: 0 },
        unit: 'FEET'
      },
      actorIdByTokenId,
      sceneTokens: tokens.map((token) =>
        token.id === GOBLIN_TOKEN_ID ? { ...token, position: START_POINT } : token
      ),
      root: {
        commandId: COMMAND_ID,
        commandFingerprint: 'a'.repeat(64),
        initiatorUserId: GM_USER_ID,
        correlationId: null,
        encounterId: state.id,
        sceneId: SCENE_ID,
        tokenId: GOBLIN_TOKEN_ID,
        expectedEncounterVersion: state.version,
        expectedSceneVersion: 1,
        movementKind: 'VOLUNTARY',
        originalPath: ENTERING_PATH
      },
      currentPosition: START_POINT,
      occurrenceId: OCCURRENCE_ID,
      executionCommandId: testUuid(0xd02),
      occurredAt: OCCURRED_AT
    },
    state,
    userId: GM_USER_ID,
    runtime: createSrdRulesRuntime(),
    random: () => 0,
    spatialScope: scope,
    loadTargets: async (actorIds) =>
      new Map(
        actorIds.map((actorId) => [
          actorId,
          srdCreatureTarget(actors.find((actor) => actor.id === actorId)!)
        ])
      ),
    settleTerminal: async (plan) => {
      settled.push(plan)
      return projectPreparedSpatialMovementReceipt(plan)
    }
  })
  const plan = settled[0]
  if (prepared.kind !== 'TERMINAL' || !plan) throw new Error('The movement must plan a contact.')
  const preparation = sceneSpatialPreparationSchema.parse({
    encounterId: state.id,
    expectedEncounterVersion: state.version,
    occurrenceId: OCCURRENCE_ID,
    occurredAt: OCCURRED_AT,
    outcome: {
      kind: 'TERMINAL',
      result: prepared.result,
      selectionChecksum: prepared.selectionChecksum,
      currentnessChecksum: prepared.currentnessChecksum
    }
  })
  const settlement = liveSessionMovementSettlementSchema.parse({
    kind: 'SPATIAL',
    executions: plan.executions,
    transitions: [...plan.effects.values()].map((effect) => ({
      effectId: effect.id,
      transition: spatialEffectTransition(effect)
    }))
  })
  const save = sceneStoredGeometrySaveSchema.parse({
    id: testUuid(0xd03),
    sceneId: SCENE_ID,
    commandId: COMMAND_ID,
    actorUserId: GM_USER_ID,
    input: {
      type: 'MOVE_SCENE_TOKEN',
      commandId: COMMAND_ID,
      expectedSceneVersion: 1,
      sceneId: SCENE_ID,
      expectedEncounterVersion: state.version,
      correlationId: null,
      movementKind: 'VOLUNTARY',
      tokenId: GOBLIN_TOKEN_ID,
      path: ENTERING_PATH
    },
    inputChecksum: checksumCanonicalJson({}),
    snapshotVersion: 1,
    status: 'RECEIVING',
    expiresAt: Date.now() + 60_000,
    fogSaves: []
  })
  return { ctx, scope, zone, state, preparation, settlement, save }
}

describe('persistMovementSettlements spatial zone currentness', () => {
  it('refuses a contact whose zone was deleted after planning', async () => {
    const { ctx, scope, zone, state, preparation, settlement, save } =
      await plannedMovementThroughZone()
    await scope.deleteCas({ id: zone.id, expectedVersion: zone.version })

    await expect(
      persistMovementSettlements(
        ctx,
        {
          state,
          actors,
          authorizedCharacterIds: new Set<string>(),
          save,
          preparation,
          settlements: [settlement],
          userId: GM_USER_ID
        },
        {
          persistSpatial: unreachable,
          persistReaction: unreachable,
          persistConcentration: unreachable,
          persistConcentrationEnd: unreachable,
          persistAreaDeparture: unreachable,
          persistMoveEnd: unreachable,
          endHolderGrants: unreachable,
          applyMechanics: unreachable
        }
      )
    ).rejects.toThrow('Movement spatial effect changed.')
  })
})
