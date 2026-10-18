import { beforeAll, describe, expect, it } from 'vitest'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'

import { prepareMaintainedEffectStateRecord } from '../activeRuleEffectRecords.js'
import {
  projectEncounterMovementConcentrationEnd,
  type MovementCharacterRow,
  type MovementMaintenanceOwner
} from '../encounterMovementMaintenance.js'
import type { RulesRuntimeService } from '../rulesRuntimeService.js'
import {
  CAMPAIGN_ID,
  createSrdRulesRuntime,
  ENCOUNTER_ID,
  SRD_SYSTEM_ID,
  srdCreatureActor,
  srdCreatureTarget,
  testUuid,
  TIMESTAMP
} from '../testing/dnd5eSrdEncounter.js'
import {
  FRIGHTENED_CONDITION_ID,
  GOBLIN,
  GOBLIN_SCALARS,
  POISONED_CONDITION_ID,
  PRONE_CONDITION_ID,
  RESTRAINED_CONDITION_ID,
  turnSaveDamageEffect
} from './encounterActiveEffectFixtures.js'

const CASTER_ID = testUuid(0x300)
// The second target sorts first, so the owner transitions must be reordered.
const FIRST_TARGET_ID = testUuid(0x302)
const SECOND_TARGET_ID = testUuid(0x301)
const MISSING_TARGET_ID = testUuid(0x303)
const STATE_ID = testUuid(0x310)
const MAINTENANCE_DEFINITION_ID = testUuid(0x311)
const OTHER_SLOT_KEY = `${CASTER_ID}:${testUuid(0x312)}`
const SLOT_KEY = `${CASTER_ID}:${MAINTENANCE_DEFINITION_ID}`

const state = prepareMaintainedEffectStateRecord({
  id: STATE_ID,
  encounterId: ENCOUNTER_ID,
  ownerActorId: CASTER_ID,
  descriptor: {
    schemaVersion: 2,
    maintenanceDefinitionId: MAINTENANCE_DEFINITION_ID,
    definitionChecksum: 'c'.repeat(64),
    provenance: {
      kind: 'ACTION',
      sourceActionId: 'concentration-source-action',
      sourceOccurrenceId: testUuid(0x313)
    },
    sourceActorId: CASTER_ID,
    replacementPolicy: 'REPLACE_SAME_DEFINITION',
    emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY'
  },
  occurredAt: TIMESTAMP
})

const firstActor = srdCreatureActor({
  id: FIRST_TARGET_ID,
  creature: GOBLIN,
  currentHitPoints: 5,
  conditionIds: [
    PRONE_CONDITION_ID,
    POISONED_CONDITION_ID,
    FRIGHTENED_CONDITION_ID,
    RESTRAINED_CONDITION_ID
  ]
})
const secondActor = srdCreatureActor({
  id: SECOND_TARGET_ID,
  creature: GOBLIN,
  conditionIds: [RESTRAINED_CONDITION_ID]
})

let runtime: RulesRuntimeService
let firstRemoved: ActiveRuleEffectRecord
let firstKept: ActiveRuleEffectRecord
let secondRemoved: ActiveRuleEffectRecord

beforeAll(async () => {
  runtime = createSrdRulesRuntime()
  // Dependent effects the caster's Concentration maintains; only the owned conditions matter here.
  firstRemoved = await turnSaveDamageEffect({
    runtime,
    seed: 1,
    target: firstActor,
    damage: 1,
    saveDc: 10,
    ticks: null,
    sourceActorId: CASTER_ID,
    maintainedEffectStateId: STATE_ID,
    conditionOwnership: [
      { conditionId: PRONE_CONDITION_ID, baselinePresent: false },
      { conditionId: POISONED_CONDITION_ID, baselinePresent: true },
      { conditionId: FRIGHTENED_CONDITION_ID, baselinePresent: false }
    ]
  })
  firstKept = await turnSaveDamageEffect({
    runtime,
    seed: 2,
    target: firstActor,
    damage: 1,
    saveDc: 10,
    ticks: null,
    conditionOwnership: [{ conditionId: FRIGHTENED_CONDITION_ID, baselinePresent: false }],
    currentEffects: [firstRemoved]
  })
  secondRemoved = await turnSaveDamageEffect({
    runtime,
    seed: 3,
    target: secondActor,
    damage: 1,
    saveDc: 10,
    ticks: null,
    sourceActorId: CASTER_ID,
    maintainedEffectStateId: STATE_ID,
    conditionOwnership: [{ conditionId: RESTRAINED_CONDITION_ID, baselinePresent: false }]
  })
})

function owner(actorId: string, effects: ActiveRuleEffectRecord[]) {
  return {
    owner: { kind: 'ENCOUNTER_ACTOR' as const, encounterId: ENCOUNTER_ID, targetActorId: actorId },
    effects,
    character: null
  }
}

function concentrationEnd(owners: MovementMaintenanceOwner<MovementCharacterRow>[]) {
  const priorSlots = new Map([
    [SLOT_KEY, { state, dependents: [firstRemoved, secondRemoved], zoneIds: [] }],
    [OTHER_SLOT_KEY, { state: null, dependents: [], zoneIds: [] }]
  ])
  return projectEncounterMovementConcentrationEnd(
    {
      targets: new Map([
        [FIRST_TARGET_ID, srdCreatureTarget(firstActor, [firstRemoved, firstKept])],
        [SECOND_TARGET_ID, srdCreatureTarget(secondActor, [secondRemoved])]
      ]),
      projection: { slots: priorSlots, owners: new Map() },
      campaignId: CAMPAIGN_ID,
      gameSystemId: SRD_SYSTEM_ID,
      occurredAt: TIMESTAMP,
      maintenance: {
        state,
        removed: [firstRemoved, secondRemoved],
        zoneIds: [],
        owners,
        characterVersions: []
      }
    },
    () => {
      throw new Error('Creature owners read no Character.')
    }
  )
}

describe('projectEncounterMovementConcentrationEnd', () => {
  it('removes the dependents, empties the slot and drops only conditions no one else holds', () => {
    const firstOwner = owner(FIRST_TARGET_ID, [firstRemoved, firstKept])
    const secondOwner = owner(SECOND_TARGET_ID, [secondRemoved])

    const result = concentrationEnd([firstOwner, secondOwner])

    expect(result.cleanup).toEqual({
      maintainedStateId: STATE_ID,
      removedDependentEffectIds: [firstRemoved.id, secondRemoved.id],
      removedZoneIds: [],
      characterOwnerTransitions: []
    })
    expect([...result.projection.slots]).toEqual([
      [SLOT_KEY, { state: null, dependents: [], zoneIds: [] }],
      [OTHER_SLOT_KEY, { state: null, dependents: [], zoneIds: [] }]
    ])
    expect([...result.projection.owners]).toEqual([
      [checksumCanonicalJson(firstOwner.owner), { ...firstOwner, effects: [firstKept] }],
      [checksumCanonicalJson(secondOwner.owner), { ...secondOwner, effects: [] }]
    ])
    // Prone ended; Poisoned was present before the effect; Frightened is still owned by another effect.
    const first = result.targets.get(FIRST_TARGET_ID)
    expect(first?.state.conditions).toEqual([
      POISONED_CONDITION_ID,
      FRIGHTENED_CONDITION_ID,
      RESTRAINED_CONDITION_ID
    ])
    expect(first?.activeEffects.map((effect) => effect.id)).toEqual([firstKept.id])
    expect(result.targets.get(SECOND_TARGET_ID)?.state.conditions).toEqual([])
    expect(result.ownerTransitions).toEqual([
      {
        targetActorId: SECOND_TARGET_ID,
        characterId: null,
        before: {
          currentHitPoints: 7,
          temporaryHitPoints: 0,
          maximumHitPoints: 7,
          scalarValues: GOBLIN_SCALARS,
          conditionIds: [RESTRAINED_CONDITION_ID],
          deathSaves: null
        },
        after: {
          currentHitPoints: 7,
          temporaryHitPoints: 0,
          maximumHitPoints: 7,
          scalarValues: GOBLIN_SCALARS,
          conditionIds: [],
          deathSaves: null
        }
      },
      {
        targetActorId: FIRST_TARGET_ID,
        characterId: null,
        before: {
          currentHitPoints: 5,
          temporaryHitPoints: 0,
          maximumHitPoints: 7,
          scalarValues: GOBLIN_SCALARS,
          conditionIds: [
            PRONE_CONDITION_ID,
            POISONED_CONDITION_ID,
            FRIGHTENED_CONDITION_ID,
            RESTRAINED_CONDITION_ID
          ],
          deathSaves: null
        },
        after: {
          currentHitPoints: 5,
          temporaryHitPoints: 0,
          maximumHitPoints: 7,
          scalarValues: GOBLIN_SCALARS,
          conditionIds: [POISONED_CONDITION_ID, FRIGHTENED_CONDITION_ID, RESTRAINED_CONDITION_ID],
          deathSaves: null
        }
      }
    ])
  })

  it('refuses an Encounter owner whose target is not loaded', () => {
    expect(() =>
      concentrationEnd([
        owner(FIRST_TARGET_ID, [firstRemoved, firstKept]),
        owner(MISSING_TARGET_ID, [])
      ])
    ).toThrow(new Error('Movement maintenance Encounter owner is unavailable.'))
  })
})
