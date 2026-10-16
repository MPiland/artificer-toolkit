import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'

import { testUuid } from './dnd5eSrdEncounter.js'

export const UNCONDITIONAL_SNEAK_ATTACK_ID = testUuid(0xa01)

const SNEAK_ATTACK_DICE = [
  [1, '1d6'],
  [3, '2d6'],
  [5, '3d6']
] as const

/**
 * A homebrew Rogue Feature with Sneak Attack's damage and none of its conditions: every melee
 * weapon hit deals extra damage of the weapon's own type, with dice that grow with the Rogue's
 * class level (1d6 at 1st, 2d6 at 3rd, 3d6 at 5th).
 */
export function unconditionalSneakAttack(rogueClassId: string): FeatureAuthored {
  const pathId = testUuid(0xa04)
  return {
    id: UNCONDITIONAL_SNEAK_ATTACK_ID,
    label: 'Unconditional Sneak Attack',
    description: 'Your weapon hits deal extra damage as you gain Rogue levels.',
    availableAtLevel: 1,
    order: 1,
    effects: [
      {
        id: testUuid(0xa02),
        order: 1,
        invocation: {
          kind: 'PASSIVE',
          triggerCode: 'MELEE_WEAPON_ATTACK',
          range: { id: testUuid(0xa03), rangeKind: 'SPECIAL' },
          targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'HOSTILE' }
        },
        paths: [
          {
            id: pathId,
            order: 1,
            pathCode: 'ON_HIT',
            groupType: 'SINGLE',
            originKind: 'SOURCE',
            selectionKind: 'FIXED',
            resultBlock: {
              id: testUuid(0xa06),
              resultKind: 'SINGLE',
              outcomes: [
                {
                  id: testUuid(0xa05),
                  effectKind: 'DAMAGE',
                  usesTriggeringWeaponDamageType: true,
                  valueKind: 'DICE',
                  scalingKind: 'PER_LEVEL',
                  scalingSource: 'CLASS_LEVEL',
                  classId: rogueClassId,
                  levels: SNEAK_ATTACK_DICE.map(([level, diceConfig], index) => ({
                    id: testUuid(0xa10 + index),
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
