import { beforeAll, describe, expect, it } from 'vitest'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SceneGrid } from '@artificer-toolkit/shared/vtt'

import { planEncounterPassiveZones } from '../encounterPassiveZones.js'
import { plannedSpatialEffectRecord } from '../encounterPlacedZone.js'
import { prepareEncounterTurnZoneEffects } from '../encounterTurnZoneEffects.js'
import type { RulesRuntimeService } from '../rulesRuntimeService.js'
import { creatureAuraFeature, withFeature } from '../testing/authoredZoneFixture.js'
import { system } from '../testing/characterContextFixtures.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import {
  createSrdRulesRuntime,
  ENCOUNTER_ID,
  srdCreatureActor,
  srdCreatureTarget,
  srdDefinitions,
  srdEncounterState,
  testUuid,
  TIMESTAMP
} from '../testing/dnd5eSrdEncounter.js'
import {
  AUTO_ROLL,
  GM_USER_ID,
  goblin,
  GOBLIN_ID,
  GOBLIN_TOKEN_ID,
  OCCURRENCE_ID,
  root,
  SCENE_ID,
  SOURCE_ID,
  SOURCE_TOKEN_ID,
  ZONE_POINT
} from '../testing/encounterTurnZoneFixture.js'

const GRID: SceneGrid = {
  kind: 'SQUARE',
  cellSize: 100,
  diagonalPolicy: 'EQUAL',
  distancePerCell: 5,
  origin: { x: 0, y: 0 },
  unit: 'FEET'
}
const SEARING_GOBLIN = withFeature(srdByLabel(SRD.creatures, 'Goblin'), creatureAuraFeature('1d6'))
const searing = (input: { defeated?: boolean } = {}) =>
  srdCreatureActor({
    id: SOURCE_ID,
    creature: SEARING_GOBLIN,
    ...(input.defeated ? { defeated: true, currentHitPoints: 0 } : {})
  })
// The aura's source stands one square from the goblin.
const tokens = [
  { id: GOBLIN_TOKEN_ID, position: ZONE_POINT, width: 100, height: 100 },
  {
    id: SOURCE_TOKEN_ID,
    position: { x: ZONE_POINT.x + 100, y: ZONE_POINT.y },
    width: 100,
    height: 100
  }
]
const actorIdByTokenId = new Map([
  [GOBLIN_TOKEN_ID, GOBLIN_ID],
  [SOURCE_TOKEN_ID, SOURCE_ID]
])
const SOURCE_START = { ordinal: 1, stage: 'START_OF_TURN', actorId: SOURCE_ID } as const

function plan(actors: readonly EncounterRunActorState[], bindings = actorIdByTokenId) {
  return planEncounterPassiveZones({
    state: srdEncounterState({ actors, currentActorId: GOBLIN_ID }),
    occurrenceId: OCCURRENCE_ID,
    rootCommandId: root.rootCommandId,
    actors,
    system,
    sceneGrid: GRID,
    tokens,
    actorIdByTokenId: bindings
  })
}

describe('placing a Creature’s passive zones (SPELLS-20 T6b, D144)', () => {
  it('anchors one zone to each bound Creature’s token, with no Concentration behind it', () => {
    const [zone, ...others] = plan([goblin, searing()])
    expect(others).toEqual([])
    expect(zone).toMatchObject({
      maintainedEffectStateId: null,
      definition: { origin: { kind: 'ENCOUNTER', sourceActorId: SOURCE_ID } },
      placement: {
        anchorKind: 'TOKEN',
        sourceTokenId: SOURCE_TOKEN_ID,
        turnTriggers: ['START_OF_SOURCE_TURN']
      }
    })
  })

  it('names the same zone when placed again, whatever command places it', () => {
    const [first] = plan([searing()])
    const [again] = planEncounterPassiveZones({
      state: srdEncounterState({ actors: [searing()], currentActorId: SOURCE_ID }),
      occurrenceId: testUuid(0x3f1),
      rootCommandId: testUuid(0x3f2),
      actors: [searing()],
      system,
      sceneGrid: GRID,
      tokens,
      actorIdByTokenId
    })
    expect(again!.id).toBe(first!.id)
  })

  it('places nothing for a Creature with no token in the Scene', () => {
    expect(plan([searing()], new Map([[GOBLIN_TOKEN_ID, GOBLIN_ID]]))).toEqual([])
  })
})

describe('a passive zone whose source is defeated (SPELLS-20 T6b, D144)', () => {
  let runtime: RulesRuntimeService
  beforeAll(async () => {
    runtime = createSrdRulesRuntime()
  })

  const zones = plan([goblin, searing()]).map((zone, index) =>
    plannedSpatialEffectRecord(zone, {
      encounterId: ENCOUNTER_ID,
      sceneId: SCENE_ID,
      createdOrdinal: index + 1,
      createdAt: TIMESTAMP
    })
  )

  async function phaseAtSourceStart(actors: EncounterRunActorState[]) {
    const result = await prepareEncounterTurnZoneEffects({
      state: srdEncounterState({ actors, currentActorId: GOBLIN_ID, turnSequence: 3 }),
      userId: GM_USER_ID,
      root,
      occurrenceId: OCCURRENCE_ID,
      actors,
      boundary: SOURCE_START,
      loadScene: async () => ({ effects: zones, tokens, actorIdByTokenId }),
      loadTarget: async (actorId) =>
        srdCreatureTarget(actors.find((actor) => actor.id === actorId)!),
      createRuntime: async () => runtime,
      definitions: srdDefinitions,
      random: () => 0,
      autoRollByActorId: AUTO_ROLL
    })
    if (result.kind !== 'COMPLETE') throw new Error('Expected a completed zone phase.')
    return result
  }

  it('burns the creature beside its source at the start of the source’s turn', async () => {
    const phase = await phaseAtSourceStart([goblin, searing()])
    expect(phase.plan!.executions.map(({ candidate }) => candidate.candidate)).toMatchObject([
      { targetActorId: GOBLIN_ID, sourceActorId: SOURCE_ID, trigger: 'START_OF_SOURCE_TURN' }
    ])
  })

  it('catches no one while its source is defeated, and acts again once revived without being placed again', async () => {
    const defeated = await phaseAtSourceStart([goblin, searing({ defeated: true })])
    expect(defeated.plan).toBeNull()
    const revived = await phaseAtSourceStart([goblin, searing()])
    expect(revived.plan!.executions).toHaveLength(1)
  })
})
