import { characterMechanicsApplicationDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import { hideousLaughter } from '@artificer-toolkit/source-data/srd/spells/hideous-laughter.js'
import {
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { nativeConcentrationDamageApplications } from '../encounterConcentrationDamage.js'
import { planDamageSaveChain } from '../encounterDamageSaveChain.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'
import { ENCOUNTER_ID, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { plannedTimedCondition } from '../testing/plannedTimedCondition.js'
import { activeEffect } from './encounterActiveEffectFixtures.js'

const damageType = (code: string) => SRD_DAMAGE_TYPES.find((entry) => entry.code === code)!.id
const FIRE = damageType('FIRE')
const COLD = damageType('COLD')
const SLASHING = damageType('SLASHING')
const PRONE = SRD_CONDITION_TYPES.find((entry) => entry.code === 'PRONE')!.id
const CASTER_ID = testUuid(0xd220)
const HOLDER_ID = testUuid(0xd221)
const DAMAGER_ID = testUuid(0xd222)
const EFFECT_ID = testUuid(0xd223)

/** Hideous Laughter as authored from core options, its damage repeat narrowed to fire damage. */
function laughterRepeatedByFire() {
  const { definition } = plannedTimedCondition({
    encounterId: ENCOUNTER_ID,
    sourceActorId: CASTER_ID,
    holderActorId: HOLDER_ID,
    spell: hideousLaughter,
    lifetimeScope: 'ENCOUNTER'
  })
  const { repeatTriggers } = definition.recurrence
  if (!repeatTriggers) throw new Error('Hideous Laughter repeats its save on damage.')
  return {
    ...activeEffect({
      id: EFFECT_ID,
      owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: HOLDER_ID },
      createdOrdinal: 1,
      sourceActorId: CASTER_ID,
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP', conditionId: PRONE, baselinePresent: false }
      ]
    }),
    definition: {
      ...definition,
      recurrence: {
        ...definition.recurrence,
        repeatTriggers: repeatTriggers.map((trigger) => ({
          ...trigger,
          damageTypeIds: [FIRE]
        }))
      }
    }
  }
}

/** One damage row of a single source's batch against the holder. */
const dealt = (ordinal: number, damageTypeId: string) =>
  characterMechanicsApplicationDtoSchema.parse({
    ordinal,
    kind: 'DAMAGE',
    requestedAmount: 4,
    resolvedAmount: 4,
    appliedAmount: 4,
    beforeCurrentHitPoints: 40 - ordinal * 4,
    afterCurrentHitPoints: 36 - ordinal * 4,
    beforeTemporaryHitPoints: 0,
    afterTemporaryHitPoints: 0,
    maximumHitPoints: 40,
    damageTypeId,
    damageDisposition: 'NORMAL',
    incomingHalved: false,
    critical: false,
    sourceNodeId: `damage_${ordinal}`,
    sourceOperationKey: 'effect.damage',
    authoredPath: null,
    resolvedPath: null
  })

/** The saves one source that dealt `types`, in row order, owes the holder of the fire repeat. */
function savesOwed(types: readonly string[]) {
  const applications = nativeConcentrationDamageApplications([
    {
      targetActorId: HOLDER_ID,
      applications: types.map((type, ordinal) => dealt(ordinal, type)),
      damagerActorId: DAMAGER_ID
    }
  ])
  const chain = planDamageSaveChain({
    gameSystemId: DND5E_SYSTEM_ID,
    applications,
    maintainedStates: new Map(),
    parentOccurrenceId: testUuid(0xd224),
    damagerActorId: null,
    dispositions: new Map(),
    effectSaves: {
      massiveRule: null,
      holders: new Map([
        [HOLDER_ID, { defeated: false, effects: [laughterRepeatedByFire()], maximumHitPoints: 40 }]
      ])
    }
  })
  return { applications, chain }
}

describe('a damage-save application carries every damage type its source dealt (D220)', () => {
  it('owes a fire-triggered repeat save for a hit that dealt slashing and fire', () => {
    const { applications, chain } = savesOwed([SLASHING, FIRE])
    expect(applications).toMatchObject([{ appliedAmount: 8, damageTypeIds: [SLASHING, FIRE] }])
    expect(chain).toEqual([{ ...applications[0], activeEffectId: EFFECT_ID }])
  })

  it('owes no fire-triggered repeat save for a hit that dealt slashing and cold', () => {
    expect(savesOwed([SLASHING, COLD]).chain).toEqual([])
  })

  it('names each type once, in the order the rows first dealt it', () => {
    expect(savesOwed([FIRE, SLASHING, FIRE]).applications).toMatchObject([
      { appliedAmount: 12, damageTypeIds: [FIRE, SLASHING] }
    ])
  })
})
