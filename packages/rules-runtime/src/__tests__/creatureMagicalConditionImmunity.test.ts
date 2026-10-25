import { kraken } from '@artificer-toolkit/source-data/srd/creatures/kraken.js'
import { describe, expect, it } from 'vitest'

import {
  conditionImmunityIdsAgainstSource,
  encounterSourceConditionImmunities
} from '../encounterActiveGrants.js'
import { foldDnd5eCreatureFeatureGrants } from '../systems/dnd5e/creatureFeatureGrantFold.js'
import { SRD_SYSTEM_ID, srdCondition } from '../testing/dnd5eSrdEncounter.js'

const holderState = {
  kind: 'CREATURE',
  creatureTypeIds: [],
  canAct: true,
  speedAboveZero: true,
  freeHand: true,
  turnMovement: { usedFeet: 0, speedFeet: 0 },
  stowableHeldItemInstanceId: null
} as const

/** The Kraken's Freedom of Movement: magical effects can't cause it to be restrained (SPELLS-33.T4m). */
describe('the Kraken holds a condition immunity against magical sources', () => {
  const sourceConditionImmunities = encounterSourceConditionImmunities({
    effects: [],
    grantFold: { modifiers: foldDnd5eCreatureFeatureGrants(kraken) },
    holderState
  })
  const restrained = srdCondition('Restrained')
  const against = (traits: readonly 'MAGICAL'[], spellCastSystemId: string | null) =>
    conditionImmunityIdsAgainstSource(
      [],
      sourceConditionImmunities,
      { creatureTypeIds: [], traits },
      spellCastSystemId
    )

  it('is immune to restrained from a magical source only', () => {
    expect(sourceConditionImmunities.map(({ conditionTypeId }) => conditionTypeId)).toEqual([
      restrained
    ])
    expect(against(['MAGICAL'], null)).toEqual([restrained])
    expect(against([], null)).toEqual([])
  })

  it('treats every spell cast as magical through the System', () => {
    expect(against([], SRD_SYSTEM_ID)).toEqual([restrained])
  })
})
