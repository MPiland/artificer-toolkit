import type { EquipmentAuthored } from '@artificer-toolkit/shared/authored'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { meleeWeaponAbilityModifiers } from '@artificer-toolkit/source-data/srd/equipment/shared.js'
import { SRD_DAMAGE_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { testUuid } from './dnd5eSrdEncounter.js'

const GAUNTLET_ID = testUuid(0xf30)

/**
 * A homebrew simple melee weapon: a Strength attack at 5 ft. whose hit deals 2 lightning damage and, like Shocking
 * Grasp, sets the target's `REACTION_COUNT` (0: it can't take reactions) until the start of its
 * next turn. `grantPaths` lists the attack paths that apply the grant.
 */
export function joltingGauntlet(
  input: {
    grantPaths?: readonly ('ON_HIT' | 'ON_CRIT' | 'ON_MISS')[]
    reactionCount?: number
  } = {}
): EquipmentAuthored {
  const { grantPaths = ['ON_HIT'], reactionCount = 0 } = input
  const lightning = SRD_DAMAGE_TYPES.find((type) => type.code === 'LIGHTNING')
  if (!lightning) throw new Error('The SRD lightning damage type is missing.')
  return {
    ...club,
    id: GAUNTLET_ID,
    label: 'Jolting Gauntlet',
    modifiers: meleeWeaponAbilityModifiers(GAUNTLET_ID),
    effects: [
      {
        id: testUuid(0xf31),
        order: 1,
        grip: 'ONE_HANDED',
        invocation: {
          kind: 'ACTION',
          triggerCode: 'MELEE_WEAPON_ATTACK',
          activation: { code: 'ACTION', amount: 1 },
          range: { id: testUuid(0xf32), rangeKind: 'DISTANCE', amount: 5, unit: 'FEET' },
          targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
        },
        paths: [
          {
            id: testUuid(0xf33),
            order: 1,
            pathCode: 'ON_HIT',
            groupType: 'SINGLE',
            originKind: 'SOURCE',
            selectionKind: 'FIXED',
            resultBlock: {
              id: `${testUuid(0xf33)}__result`,
              resultKind: 'SINGLE',
              outcomes: [
                {
                  id: testUuid(0xf34),
                  effectKind: 'DAMAGE',
                  damageTypeId: lightning.id,
                  valueKind: 'FIXED',
                  scalingKind: 'NONE',
                  amount: 2
                }
              ]
            }
          },
          ...grantPaths.map((pathCode, index) => ({
            id: testUuid(0xf40 + index * 0x10),
            order: 2 + index,
            pathCode,
            groupType: 'SEQUENTIAL' as const,
            originKind: 'SOURCE' as const,
            selectionKind: 'FIXED' as const,
            resultBlock: {
              id: `${testUuid(0xf40 + index * 0x10)}__result`,
              resultKind: 'SEQUENCE' as const,
              duration: {
                id: testUuid(0xf41 + index * 0x10),
                durationKind: 'ROUND' as const,
                amount: 1
              },
              lifecycle: {
                turnAnchor: { actor: 'TARGET' as const, boundary: 'START_OF_TURN' as const }
              },
              outcomes: [
                {
                  id: testUuid(0xf42 + index * 0x10),
                  effectKind: 'APPLY_GRANT' as const,
                  grants: {
                    modifiers: [
                      {
                        id: testUuid(0xf43 + index * 0x10),
                        grantKind: 'MODIFIER_GRANT' as const,
                        valueDomainCode: 'REACTION_COUNT' as const,
                        domain: {},
                        modifierKind: 'SET_VALUE' as const,
                        scope: 'GLOBAL' as const,
                        selectionKind: 'GRANTED' as const,
                        payload: { amount: reactionCount },
                        order: 1
                      }
                    ]
                  }
                }
              ]
            }
          }))
        ]
      }
    ]
  }
}
