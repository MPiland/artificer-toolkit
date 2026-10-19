import { beforeAll, describe, expect, it } from 'vitest'

import { planEncounterPassiveZones } from '../encounterPassiveZones.js'
import { plannedSpatialEffectRecord } from '../encounterPlacedZone.js'
import { planSpatialHeldCondition } from '../encounterSpatialHeldCondition.js'
import { prepareEncounterTurnZoneEffects } from '../encounterTurnZoneEffects.js'
import type { RulesRuntimeService } from '../rulesRuntimeService.js'
import { system } from '../testing/characterContextFixtures.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import {
  createSrdRulesRuntime,
  ENCOUNTER_ID,
  srdCondition,
  srdCreatureActor,
  srdCreatureTarget,
  srdDefinitions,
  srdEncounterState,
  TIMESTAMP
} from '../testing/dnd5eSrdEncounter.js'
import {
  actorIdByTokenId,
  AUTO_ROLL,
  GM_USER_ID,
  goblin,
  GOBLIN_ID,
  OCCURRENCE_ID,
  root,
  SCENE_ID,
  SOURCE_ID,
  START,
  tokens
} from '../testing/encounterTurnZoneFixture.js'

/**
 * SPELLS-33.T6e: the SRD Chain Devil's Unnerving Mask, authored as a passive zone from core options,
 * frightens a creature that starts its turn within 30 feet and can see the devil, and that the devil
 * can see, until the end of that creature's turn.
 */

const FRIGHTENED = srdCondition('Frightened')
const devil = srdCreatureActor({
  id: SOURCE_ID,
  creature: srdByLabel(SRD.creatures, 'Chain Devil')
})
const actors = [goblin, devil]
// The devil stands one square from the goblin, well inside the 30-foot sphere.
const nearTokens = [tokens[0]!, { ...tokens[1]!, position: { x: 350, y: 350 } }]

let runtime: RulesRuntimeService
beforeAll(() => {
  runtime = createSrdRulesRuntime()
})

const zones = planEncounterPassiveZones({
  state: srdEncounterState({ actors, currentActorId: GOBLIN_ID }),
  occurrenceId: OCCURRENCE_ID,
  rootCommandId: root.rootCommandId,
  actors,
  system,
  sceneGrid: {
    kind: 'SQUARE',
    cellSize: 100,
    diagonalPolicy: 'EQUAL',
    distancePerCell: 5,
    origin: { x: 0, y: 0 },
    unit: 'FEET'
  },
  tokens: nearTokens,
  actorIdByTokenId,
  characterRules: new Map()
}).map((zone, index) =>
  plannedSpatialEffectRecord(zone, {
    encounterId: ENCOUNTER_ID,
    sceneId: SCENE_ID,
    createdOrdinal: index + 1,
    createdAt: TIMESTAMP
  })
)

async function startOfGoblinTurn(sight: {
  occupantSeesSource: boolean
  sourceSeesOccupant: boolean
}) {
  const result = await prepareEncounterTurnZoneEffects({
    state: srdEncounterState({ actors, currentActorId: GOBLIN_ID, turnSequence: 3 }),
    userId: GM_USER_ID,
    root,
    occurrenceId: OCCURRENCE_ID,
    actors,
    boundary: START,
    loadScene: async () => ({ effects: zones, tokens: nearTokens, actorIdByTokenId }),
    loadTarget: async (actorId) => srdCreatureTarget(actors.find((actor) => actor.id === actorId)!),
    loadSourceSight: async () => sight,
    createRuntime: async () => runtime,
    definitions: srdDefinitions,
    random: () => 0,
    autoRollByActorId: AUTO_ROLL
  })
  if (result.kind !== 'COMPLETE') throw new Error('Expected a completed zone phase.')
  return result
}

const frightened = (phase: Awaited<ReturnType<typeof startOfGoblinTurn>>) =>
  phase
    .plan!.executions.flatMap(({ applications }) => applications)
    .filter(
      (application) =>
        application.kind === 'CONDITION_APPLY' && application.conditionId === FRIGHTENED
    )

describe('the SRD Chain Devil’s Unnerving Mask (SPELLS-33.T6e)', () => {
  it('places one zone on the devil, with no closed rule behind it', () => {
    expect(zones).toHaveLength(1)
    expect(zones[0]!.placement).toMatchObject({
      label: 'Unnerving Mask',
      anchorKind: 'TOKEN',
      requiredSight: ['OCCUPANT_SEES_SOURCE', 'SOURCE_SEES_OCCUPANT'],
      heldCondition: { conditionId: FRIGHTENED, endsAtEndOfHolderTurn: true, recordsSource: true }
    })
  })

  it('frightens a creature in view that fails its Wisdom save at the start of its turn', async () => {
    const phase = await startOfGoblinTurn({ occupantSeesSource: true, sourceSeesOccupant: true })
    expect(frightened(phase)).toHaveLength(1)
  })

  it('spares a creature that cannot see the devil, or that the devil cannot see', async () => {
    for (const sight of [
      { occupantSeesSource: false, sourceSeesOccupant: true },
      { occupantSeesSource: true, sourceSeesOccupant: false }
    ])
      expect(frightened(await startOfGoblinTurn(sight))).toHaveLength(0)
  })

  it('holds the condition only until the end of the frightened creature’s own turn', async () => {
    const phase = await startOfGoblinTurn({ occupantSeesSource: true, sourceSeesOccupant: true })
    const held = planSpatialHeldCondition({
      zone: zones[0]!,
      holder: { activeEffects: [], conditionIds: [] },
      applications: phase.plan!.executions.flatMap(({ applications }) => applications),
      encounterId: ENCOUNTER_ID,
      occurrenceId: OCCURRENCE_ID,
      sourceCommandId: root.rootCommandId,
      targetActorId: GOBLIN_ID
    })
    expect(held).toMatchObject({
      lifecycle: { remainingTicks: 1 },
      definition: {
        recurrence: {
          recurrenceStage: 'END_OF_TURN',
          expiration: { kind: 'TICKS', initialRemaining: 1, decrementStage: 'END_OF_TURN' }
        },
        stateContributions: [{ conditionId: FRIGHTENED, sourceActorId: SOURCE_ID }]
      }
    })
  })
})
