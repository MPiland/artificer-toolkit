import { characterMechanicsApplicationDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import { hideousLaughter } from '@artificer-toolkit/source-data/srd/spells/hideous-laughter.js'
import {
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { nativeConcentrationDamageApplications } from '../encounterConcentrationDamage.js'
import { planDamageSaveChain } from '../encounterDamageSaveChain.js'
import { targetEndedEffects } from '../encounterEndedEffectRelease.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'
import { ENCOUNTER_ID, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { plannedTimedCondition } from '../testing/plannedTimedCondition.js'
import { activeEffect } from './encounterActiveEffectFixtures.js'

const FIRE = SRD_DAMAGE_TYPES.find((entry) => entry.code === 'FIRE')!.id
const PRONE = SRD_CONDITION_TYPES.find((entry) => entry.code === 'PRONE')!.id
const INVISIBLE = SRD_CONDITION_TYPES.find((entry) => entry.code === 'INVISIBLE')!.id
const CASTER_ID = testUuid(0xe2b0)
const HOLDER_ID = testUuid(0xe2b1)
const DAMAGER_ID = testUuid(0xe2b2)
const LAUGHTER_ID = testUuid(0xe2b3)
const UNTIL_DAMAGED_ID = testUuid(0xe2b4)
const WARD_ID = testUuid(0xe2b5)
const STATE_ID = testUuid(0xe2b6)
const CAST_AT = '2026-01-01T00:00:00.000Z'
const owner = {
  kind: 'ENCOUNTER_ACTOR',
  encounterId: ENCOUNTER_ID,
  targetActorId: HOLDER_ID
} as const

/** SRD Hideous Laughter on the holder, which repeats its save whenever the holder takes damage. */
function laughter() {
  const { definition } = plannedTimedCondition({
    encounterId: ENCOUNTER_ID,
    sourceActorId: CASTER_ID,
    holderActorId: HOLDER_ID,
    spell: hideousLaughter,
    lifetimeScope: 'ENCOUNTER'
  })
  return {
    ...activeEffect({
      id: LAUGHTER_ID,
      owner,
      createdOrdinal: 1,
      sourceActorId: CASTER_ID,
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP', conditionId: PRONE, baselinePresent: false }
      ]
    }),
    definition
  }
}

const untilDamaged = activeEffect({
  id: UNTIL_DAMAGED_ID,
  owner,
  createdOrdinal: 2,
  endTriggers: [{ event: 'DAMAGE_TAKEN', by: 'ANYONE', damageTypeIds: null }],
  sourceActorId: CASTER_ID,
  stateContributions: [
    { kind: 'CONDITION_OWNERSHIP', conditionId: INVISIBLE, baselinePresent: false }
  ]
})

/**
 * A 10-damage fire blow on a holder at 1 hit point whose Death Ward intercepts it: the damage
 * survives the holder's defenses (resolved 10), yet the holder stays at 1 hit point (applied 0).
 */
const intercepted = characterMechanicsApplicationDtoSchema.parse({
  ordinal: 0,
  kind: 'DAMAGE',
  requestedAmount: 10,
  resolvedAmount: 10,
  appliedAmount: 0,
  beforeCurrentHitPoints: 1,
  afterCurrentHitPoints: 1,
  beforeTemporaryHitPoints: 0,
  afterTemporaryHitPoints: 0,
  maximumHitPoints: 40,
  damageTypeId: FIRE,
  damageDisposition: 'NORMAL',
  incomingHalved: false,
  critical: false,
  interceptedBy: WARD_ID,
  sourceNodeId: 'damage',
  sourceOperationKey: 'effect.damage',
  authoredPath: null,
  resolvedPath: null
})

describe('the ends stage and the save chain read one hit rule (QUALITY-14.T2e2b, D132)', () => {
  it('counts an intercepted blow as a hit in both stages', () => {
    const { endedEffects } = targetEndedEffects({
      holderActorId: HOLDER_ID,
      held: [untilDamaged],
      attack: null,
      testEvidence: [],
      turnActorId: null,
      applications: [{ ...intercepted, targetActorId: HOLDER_ID }],
      damagerActorId: DAMAGER_ID,
      dispositions: new Map()
    })
    expect(endedEffects).toEqual([untilDamaged])

    const applications = nativeConcentrationDamageApplications([
      { targetActorId: HOLDER_ID, applications: [intercepted], damagerActorId: DAMAGER_ID }
    ])
    // The chain reads the damage the holder took, not the hit points the ward kept.
    expect(applications).toEqual([
      {
        ordinal: 0,
        sourceNodeId: 'damage',
        sourceOperationKey: 'effect.damage',
        targetActorId: HOLDER_ID,
        appliedAmount: 10,
        damageTypeIds: [FIRE],
        damagerActorId: DAMAGER_ID
      }
    ])
    const chain = planDamageSaveChain({
      gameSystemId: DND5E_SYSTEM_ID,
      applications,
      maintainedStates: new Map([[HOLDER_ID, [{ id: STATE_ID, createdAt: CAST_AT }]]]),
      parentOccurrenceId: testUuid(0xe2b7),
      damagerActorId: null,
      dispositions: new Map(),
      effectSaves: {
        massiveRule: null,
        holders: new Map([
          [HOLDER_ID, { defeated: false, effects: [laughter()], maximumHitPoints: 40 }]
        ])
      }
    })
    expect(chain).toEqual([
      { ...applications[0], maintainedStateId: STATE_ID, castAt: CAST_AT },
      { ...applications[0], activeEffectId: LAUGHTER_ID }
    ])
  })
})
