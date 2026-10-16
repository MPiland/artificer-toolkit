import type { FacetAuthored, FeatureAuthored } from '@artificer-toolkit/shared/authored'

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

/** One property check of a rider gate group, on the attacking weapon or on the attack's roll. */
export type RiderGateCondition =
  | { constraint?: 'EXCLUDE'; predicateCode: 'EQUIPMENT_PROPERTY'; properties: readonly ['FINESSE'] }
  | { constraint?: 'EXCLUDE'; predicateCode: 'ATTACK_ROLL_MODE'; rollMode: 'ADVANTAGE' | 'NOT_DISADVANTAGE' }
  | { constraint?: 'EXCLUDE'; predicateCode: 'ENEMY_NEAR_TARGET'; feet: number }

/** A gate of the given OR-ed groups, each an AND of checks on the attacking weapon. */
export function riderGate(...groups: readonly (readonly RiderGateCondition[])[]): FacetAuthored {
  return {
    id: testUuid(0xa20),
    groups: groups.map((conditions, groupIndex) => ({
      id: testUuid(0xa30 + groupIndex),
      order: groupIndex,
      contexts: [
        {
          id: testUuid(0xa40 + groupIndex),
          order: 0,
          subject: 'EQUIPMENT',
          authoringModeKind: 'ALL',
          conditions: conditions.map(({ constraint, ...condition }, index) => ({
            id: testUuid(0xa50 + groupIndex * 8 + index),
            order: index,
            kind: 'PREDICATE' as const,
            constraint: constraint ?? ('INCLUDE' as const),
            ...(condition.predicateCode === 'EQUIPMENT_PROPERTY'
              ? {
                  ...condition,
                  properties: [...condition.properties],
                  authoringModeKind: 'SELECTED' as const
                }
              : condition)
          }))
        }
      ]
    }))
  }
}

/** The unconditional rider, owed only while its path's gate is met. */
export function gatedSneakAttack(rogueClassId: string, gate: FacetAuthored): FeatureAuthored {
  const feature = unconditionalSneakAttack(rogueClassId)
  return {
    ...feature,
    effects: feature.effects?.map((effect) => ({
      ...effect,
      paths: effect.paths.map((path) => ({ ...path, restrictions: gate }))
    }))
  }
}
