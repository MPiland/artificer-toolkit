import { beforeAll, describe, expect, it } from 'vitest'

import {
  type PreparedSpatialMovementPlan,
  prepareEncounterSpatialMovement,
  projectPreparedSpatialMovementReceipt
} from '../encounterSpatialMovementPreparation.js'
import type { ProjectableCharacterFacts } from '../encounterActionProjection.js'
import { planSpatialHeldCondition } from '../encounterSpatialHeldCondition.js'
import { zoneSightPoint } from '../encounterZoneConcealment.js'
import type { RulesRuntimeService } from '../rulesRuntimeService.js'
import { compileItemEntry, extraId, failedSaveOnly } from '../testing/authoredZoneFixture.js'
import {
  createSrdRulesRuntime,
  srdCondition,
  srdCreatureTarget,
  srdEncounterState,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
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
} from '../testing/encounterTurnZoneFixture.js'

/**
 * QUALITY-15.T3v3b: a creature that moves within a zone it can see meets the zone's failed save and
 * is blinded for a minute; the Worker reads that sight from where the mover began its move (D223).
 */

const BLINDED = srdCondition('Blinded')
const START_POINT = { x: 50, y: 350 }
/** The walk passes through the zone at {250, 350} and ends beyond it. */
const PASSING_PATH = [START_POINT, { x: 450, y: 350 }]

const blindingZone = (
  requiredSight: 'OCCUPANT_SEES_ZONE' | 'OCCUPANT_SEES_SOURCE',
  interactionKind: 'ENTER_OR_PASS_THROUGH' | 'START_TURN_IN_SPACE' = 'ENTER_OR_PASS_THROUGH'
) =>
  authoredZone([interactionKind], undefined, { requiredSight: [requiredSight] }, (parts) => {
    failedSaveOnly({ id: extraId(21), effectKind: 'CONDITION', conditionId: BLINDED })(parts)
    parts.savePath.resultBlock.duration = { id: extraId(22), durationKind: 'MINUTE', amount: 1 }
  })
const zone = placedZone(0x3a1, blindingZone('OCCUPANT_SEES_ZONE'), 1)
const state = srdEncounterState({ actors, currentActorId: GOBLIN_ID, turnSequence: 3 })

let runtime: RulesRuntimeService
beforeAll(() => {
  runtime = createSrdRulesRuntime()
})

async function goblinWalksThrough(seesZone: boolean) {
  const sightReads: { occupantActorId: string; from: unknown; point: unknown }[] = []
  let settled: PreparedSpatialMovementPlan<ProjectableCharacterFacts> | undefined
  const evaluated = await prepareEncounterSpatialMovement({
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
        commandId: testUuid(0xb01),
        commandFingerprint: 'a'.repeat(64),
        initiatorUserId: GM_USER_ID,
        correlationId: null,
        encounterId: state.id,
        sceneId: SCENE_ID,
        tokenId: GOBLIN_TOKEN_ID,
        expectedEncounterVersion: state.version,
        expectedSceneVersion: 1,
        movementKind: 'VOLUNTARY',
        originalPath: PASSING_PATH
      },
      currentPosition: START_POINT,
      occurrenceId: OCCURRENCE_ID,
      executionCommandId: testUuid(0xb02),
      occurredAt: '2026-11-17T00:00:00.000Z',
      loadPointSight: async (read) => {
        sightReads.push(read)
        return seesZone
      }
    },
    state,
    actors,
    userId: GM_USER_ID,
    runtime,
    random: () => 0,
    spatialScope: { list: async () => [zone], get: async (id) => (id === zone.id ? zone : null) },
    loadTargets: async (actorIds) =>
      new Map(
        actorIds.map((actorId) => [
          actorId,
          srdCreatureTarget(actors.find((actor) => actor.id === actorId)!)
        ])
      ),
    settleTerminal: async (plan) => {
      settled = plan
      return projectPreparedSpatialMovementReceipt(plan)
    }
  })
  if (evaluated.kind !== 'TERMINAL' || !settled)
    throw new Error('The auto-rolled walk must settle its contact.')
  const [execution, ...rest] = settled.executions
  if (!execution || rest.length) throw new Error('The walk must meet the zone once.')
  return { execution, sightReads }
}

const heldBlindness = (execution: Awaited<ReturnType<typeof goblinWalksThrough>>['execution']) =>
  planSpatialHeldCondition({
    zone,
    holder: { activeEffects: [], conditionIds: [] },
    applications: execution.applications,
    encounterId: state.id,
    occurrenceId: OCCURRENCE_ID,
    sourceCommandId: testUuid(0xb02),
    targetActorId: GOBLIN_ID
  })

describe('a zone that blinds a creature moving within it while seeing it (QUALITY-15.T3v3b, D223)', () => {
  it('blinds a mover that sees the zone from where it began and fails the save, for 10 of its turns', async () => {
    const { execution, sightReads } = await goblinWalksThrough(true)

    expect(sightReads).toEqual([
      {
        occupantActorId: GOBLIN_ID,
        from: START_POINT,
        point: zoneSightPoint(zone.placement.geometry.shape)
      }
    ])
    expect(execution.execution.outputs.resultPath).toBe('ON_SAVE_FAIL')
    expect(heldBlindness(execution)).toMatchObject({
      lifecycle: { remainingTicks: 10 },
      definition: { stateContributions: [{ conditionId: BLINDED, baselinePresent: false }] }
    })
  })

  it('spares a mover that cannot see the zone from where it began, which succeeds unrolled', async () => {
    const { execution } = await goblinWalksThrough(false)

    expect(execution.execution.outputs.resultPath).toBe('ON_SAVE_SUCCESS')
    expect(heldBlindness(execution)).toBeNull()
  })

  it('keeps manual a moved-through zone that needs sight between its source and occupant', () => {
    // The same zone compiles when it acts at a turn boundary, where the occupant's source sight is read.
    expect(
      compileItemEntry(blindingZone('OCCUPANT_SEES_SOURCE', 'START_TURN_IN_SPACE')).compilation
    ).toMatchObject({ kind: 'COMPILED' })
    expect(compileItemEntry(blindingZone('OCCUPANT_SEES_SOURCE')).compilation).toMatchObject({
      kind: 'MANUAL'
    })
  })
})
