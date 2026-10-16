import { SRD_DAMAGE_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'

import { testUuid } from './dnd5eSrdEncounter.js'

export const OPTIONAL_SMITE_FEATURE_ID = testUuid(0xb01)
export const OPTIONAL_SMITE_EFFECT_ID = testUuid(0xb02)

const SMITE_DICE = [
  [1, '2d8'],
  [2, '3d8'],
  [3, '4d8'],
  [4, '5d8']
] as const

/**
 * A homebrew melee-weapon Feature built only from core options: after a hit its wielder may pay a
 * spell slot of any level to add radiant dice that grow with that level (2d8 at 1st, 5d8 from 4th).
 */
export function optionalSmite(): FeatureAuthored {
  const radiant = SRD_DAMAGE_TYPES.find((entry) => entry.code === 'RADIANT')
  if (!radiant) throw new Error('SRD damage type "RADIANT" is missing.')
  return {
    id: OPTIONAL_SMITE_FEATURE_ID,
    label: 'Optional Smite',
    description: 'After a hit you may spend a spell slot to add radiant damage.',
    availableAtLevel: 1,
    order: 1,
    effects: [
      {
        id: OPTIONAL_SMITE_EFFECT_ID,
        order: 1,
        invocation: {
          kind: 'PASSIVE',
          triggerCode: 'MELEE_WEAPON_ATTACK',
          range: { id: testUuid(0xb03), rangeKind: 'SPECIAL' },
          targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'HOSTILE' },
          optionalOnHit: { kind: 'SPELL_SLOT' }
        },
        paths: [
          {
            id: testUuid(0xb04),
            order: 1,
            pathCode: 'ON_HIT',
            groupType: 'SINGLE',
            originKind: 'SOURCE',
            selectionKind: 'FIXED',
            resultBlock: {
              id: testUuid(0xb05),
              resultKind: 'SINGLE',
              outcomes: [
                {
                  id: testUuid(0xb06),
                  effectKind: 'DAMAGE',
                  damageTypeId: radiant.id,
                  valueKind: 'DICE',
                  scalingKind: 'PER_LEVEL',
                  scalingSource: 'SPELL_CAST_LEVEL',
                  levels: SMITE_DICE.map(([level, diceConfig], index) => ({
                    id: testUuid(0xb10 + index),
                    level,
                    order: index + 1,
                    diceConfig
                  }))
                }
              ]
            }
          }
        ]
      }
    ]
  }
}
