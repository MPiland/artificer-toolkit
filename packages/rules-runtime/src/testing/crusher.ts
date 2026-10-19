import type { FacetAuthored, FeatureAuthored } from '@artificer-toolkit/shared/authored'

import { testUuid } from './dnd5eSrdEncounter.js'

export const CRUSHER_ID = testUuid(0xc01)
export const CRUSHER_FORCED_MOVEMENT_ID = testUuid(0xc05)

/** A restriction met only by an attack whose hit deals (or, excluded, does not deal) the damage type. */
export function dealsDamageTypeGate(
  damageTypeId: string,
  constraint: 'INCLUDE' | 'EXCLUDE' = 'INCLUDE'
): FacetAuthored {
  return {
    id: testUuid(0xc10),
    groups: [
      {
        id: testUuid(0xc11),
        order: 0,
        contexts: [
          {
            id: testUuid(0xc12),
            order: 0,
            subject: 'EQUIPMENT',
            authoringModeKind: 'ALL',
            conditions: [
              {
                id: testUuid(0xc13),
                order: 0,
                kind: 'PREDICATE',
                constraint,
                predicateCode: 'DAMAGE_TYPE',
                authoringModeKind: 'SELECTED',
                damageTypeIds: [damageTypeId]
              }
            ]
          }
        ]
      }
    ]
  }
}

/**
 * A homebrew feat after Crusher: once per turn, a melee weapon hit that deals bludgeoning damage
 * moves its target 5 feet to a free space in any direction. Unlike the printed feat the move is
 * not optional, since an on-hit rider's only player choice is a paid one (D123).
 */
export function crusher(bludgeoningDamageTypeId: string): FeatureAuthored {
  return {
    id: CRUSHER_ID,
    label: 'Crusher',
    description: 'Once per turn, a bludgeoning hit moves its target 5 feet in any direction.',
    availableAtLevel: 1,
    order: 1,
    effects: [
      {
        id: testUuid(0xc02),
        order: 1,
        invocation: {
          kind: 'PASSIVE',
          triggerCode: 'MELEE_WEAPON_ATTACK',
          range: { id: testUuid(0xc03), rangeKind: 'SPECIAL' },
          targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'HOSTILE' }
        },
        paths: [
          {
            id: testUuid(0xc04),
            order: 1,
            pathCode: 'ON_HIT',
            groupType: 'SINGLE',
            originKind: 'SOURCE',
            selectionKind: 'FIXED',
            restrictions: dealsDamageTypeGate(bludgeoningDamageTypeId),
            usage: 'ONCE_PER_TURN',
            resultBlock: {
              id: testUuid(0xc06),
              resultKind: 'SINGLE',
              outcomes: [
                {
                  id: CRUSHER_FORCED_MOVEMENT_ID,
                  effectKind: 'FORCED_MOVEMENT',
                  direction: 'ANY',
                  actionEconomy: 'NONE',
                  distanceMode: 'EXACT',
                  amount: 5,
                  unit: 'FEET'
                }
              ]
            }
          }
        ]
      }
    ]
  }
}
