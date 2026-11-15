import { hideousLaughter } from '@artificer-toolkit/source-data/srd/spells/hideous-laughter.js'
import {
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import {
  encounterAreaTargetCommandId,
  encounterAreaTargetOccurrenceId
} from '../encounterAreaPending.js'
import { planDamageSaveChain, committedDamagedDiscovery } from '../encounterDamageSaveChain.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'
import { ENCOUNTER_ID, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { plannedTimedCondition } from '../testing/plannedTimedCondition.js'
import { activeEffect } from './encounterActiveEffectFixtures.js'

/**
 * QUALITY-14.T2e2b2 (D167): an area places each caught creature's effect under that creature's
 * entry occurrence. The chain once left out only effects whose origin named the area's own
 * occurrence, so an effect the area's entry had just placed repeated against the area's own damage.
 * T2e2b3 moved that exclusion into the settled re-derivation of the holder's damaged discovery
 * (`committedDamagedDiscovery`), which an action's or area's persistence feeds the chain.
 */

const FIRE = SRD_DAMAGE_TYPES.find((entry) => entry.code === 'FIRE')!.id
const PRONE = SRD_CONDITION_TYPES.find((entry) => entry.code === 'PRONE')!.id
const CASTER_ID = testUuid(0xe2c0)
const HOLDER_ID = testUuid(0xe2c1)
const AREA_OCCURRENCE_ID = testUuid(0xe2c2)
const EARLIER_OCCURRENCE_ID = testUuid(0xe2c3)
const PLACED_ID = testUuid(0xe2c4)
const EARLIER_ID = testUuid(0xe2c5)
const ENTRY_OCCURRENCE_ID = encounterAreaTargetOccurrenceId(AREA_OCCURRENCE_ID, HOLDER_ID)

/** SRD Hideous Laughter on the holder, placed by the command whose occurrence `sourceOccurrenceId` names. */
function laughter(id: string, sourceOccurrenceId: string, rootCommandId: string) {
  const planned = plannedTimedCondition({
    encounterId: ENCOUNTER_ID,
    sourceActorId: CASTER_ID,
    holderActorId: HOLDER_ID,
    spell: hideousLaughter,
    lifetimeScope: 'ENCOUNTER'
  })
  return {
    ...activeEffect({
      id,
      owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: HOLDER_ID },
      createdOrdinal: 1,
      sourceActorId: CASTER_ID,
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP', conditionId: PRONE, baselinePresent: false }
      ]
    }),
    definition: {
      ...planned.definition,
      origin: { ...planned.definition.origin, sourceOccurrenceId, rootCommandId }
    }
  }
}

const damage = {
  ordinal: 0,
  sourceNodeId: 'damage',
  sourceOperationKey: 'effect.damage',
  targetActorId: HOLDER_ID,
  appliedAmount: 6,
  damageTypeIds: [FIRE]
}

describe('the save chain leaves out the effects the damaging command placed (QUALITY-14.T2e2b2)', () => {
  it("owes no repeat save for an effect the area's entry placed, and one for an effect held before", () => {
    const placed = laughter(
      PLACED_ID,
      ENTRY_OCCURRENCE_ID,
      encounterAreaTargetCommandId(ENTRY_OCCURRENCE_ID)
    )
    const earlier = laughter(EARLIER_ID, EARLIER_OCCURRENCE_ID, testUuid(0xe2c6))
    const chain = planDamageSaveChain({
      gameSystemId: DND5E_SYSTEM_ID,
      applications: [damage],
      maintainedStates: new Map(),
      damagerActorId: CASTER_ID,
      dispositions: new Map(),
      effectSaves: {
        massiveRule: null,
        holders: new Map([
          [
            HOLDER_ID,
            {
              defeated: false,
              repeatSaveEffects: committedDamagedDiscovery({
                holderActorId: HOLDER_ID,
                effects: [placed, earlier],
                commandOccurrenceIds: [AREA_OCCURRENCE_ID, ENTRY_OCCURRENCE_ID],
                applications: [damage],
                damagerActorId: CASTER_ID,
                dispositions: new Map()
              }),
              maximumHitPoints: 11
            }
          ]
        ])
      }
    })
    expect(chain).toEqual([{ ...damage, activeEffectId: EARLIER_ID }])
  })
})
