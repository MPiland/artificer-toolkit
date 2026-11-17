import { beforeAll, describe, expect, it } from 'vitest'

import { planSpatialHeldCondition } from '../encounterSpatialHeldCondition.js'
import { prepareEncounterTurnZoneEffects } from '../encounterTurnZoneEffects.js'
import type { RulesRuntimeService } from '../rulesRuntimeService.js'
import { extraId, failedSaveOnly, zonePlacementOf } from '../testing/authoredZoneFixture.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import {
  createSrdRulesRuntime,
  srdCondition,
  srdCreatureActor,
  srdCreatureTarget,
  srdDefinitions,
  srdEncounterState,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
import {
  actorIdByTokenId,
  AUTO_ROLL,
  authoredZone,
  GM_USER_ID,
  GOBLIN_ID,
  OCCURRENCE_ID,
  placedZone,
  root,
  SOURCE_ID,
  source,
  START,
  tokens
} from '../testing/encounterTurnZoneFixture.js'

/**
 * QUALITY-15.T3v3: a zone whose failed save blinds, for a minute, a creature that can see the zone
 * (the Prismatic Wall's proximity rule), authored from core options: a turn-boundary save whose
 * failure applies Blinded for 1 minute and that needs the occupant to see the zone.
 */

const BLINDED = srdCondition('Blinded')
const GOBLIN = srdByLabel(SRD.creatures, 'Goblin')

const blindingZone = () =>
  authoredZone(
    ['START_TURN_IN_SPACE'],
    undefined,
    { requiredSight: ['OCCUPANT_SEES_ZONE'] },
    (parts) => {
      failedSaveOnly({ id: extraId(21), effectKind: 'CONDITION', conditionId: BLINDED })(parts)
      parts.savePath.resultBlock.duration = {
        id: extraId(22),
        durationKind: 'MINUTE',
        amount: 1
      }
    }
  )
const zone = placedZone(0x3a1, blindingZone(), 1)

let runtime: RulesRuntimeService
beforeAll(() => {
  runtime = createSrdRulesRuntime()
})

async function startOfGoblinTurn(input: { seesZone: boolean; blinded?: boolean }) {
  const goblin = srdCreatureActor({
    id: GOBLIN_ID,
    creature: GOBLIN,
    ...(input.blinded ? { conditionIds: [BLINDED] } : {})
  })
  const actors = [goblin, source]
  const result = await prepareEncounterTurnZoneEffects({
    state: srdEncounterState({ actors, currentActorId: GOBLIN_ID, turnSequence: 3 }),
    userId: GM_USER_ID,
    root,
    occurrenceId: OCCURRENCE_ID,
    actors,
    boundary: START,
    loadScene: async () => ({ effects: [zone], tokens, actorIdByTokenId }),
    loadTarget: async (actorId) => srdCreatureTarget(actors.find((actor) => actor.id === actorId)!),
    loadSourceSight: async () => ({ occupantSeesSource: true, sourceSeesOccupant: true }),
    loadPointSight: async () => input.seesZone,
    createRuntime: async () => runtime,
    definitions: srdDefinitions,
    random: () => 0,
    autoRollByActorId: AUTO_ROLL
  })
  if (result.kind !== 'COMPLETE') throw new Error('Expected a completed zone phase.')
  return { phase: result, holder: { activeEffects: [], conditionIds: goblin.conditions } }
}

const heldBlindness = ({ phase, holder }: Awaited<ReturnType<typeof startOfGoblinTurn>>) =>
  planSpatialHeldCondition({
    zone,
    holder,
    applications: phase.plan!.executions.flatMap(({ applications }) => applications),
    encounterId: testUuid(0x3f0),
    occurrenceId: OCCURRENCE_ID,
    sourceCommandId: root.rootCommandId,
    targetActorId: GOBLIN_ID
  })

describe('a zone that blinds a creature seeing it for a minute (QUALITY-15.T3v3, D223)', () => {
  it('authors the minute as ten of the holder’s turns', () => {
    expect(zonePlacementOf(blindingZone())).toMatchObject({
      requiredSight: ['OCCUPANT_SEES_ZONE'],
      heldCondition: { conditionId: BLINDED, holderTurns: 10 }
    })
  })

  it('blinds a creature that sees the zone and fails the save, for 10 of its turns', async () => {
    const held = heldBlindness(await startOfGoblinTurn({ seesZone: true }))
    expect(held).toMatchObject({
      lifecycle: { remainingTicks: 10 },
      definition: {
        origin: { sourceActorId: SOURCE_ID },
        recurrence: {
          recurrenceStage: 'END_OF_TURN',
          expiration: { kind: 'TICKS', initialRemaining: 10, decrementStage: 'END_OF_TURN' }
        },
        stateContributions: [{ conditionId: BLINDED, baselinePresent: false }]
      }
    })
  })

  it('spares a creature that cannot see the zone, which succeeds on the save unrolled', async () => {
    const run = await startOfGoblinTurn({ seesZone: false })
    expect(run.phase.plan!.executions[0]!.execution.outputs.resultPath).toBe('ON_SAVE_SUCCESS')
    expect(heldBlindness(run)).toBeNull()
  })

  it('leaves a creature that is already blinded as it is', async () => {
    expect(heldBlindness(await startOfGoblinTurn({ seesZone: true, blinded: true }))).toBeNull()
  })
})
