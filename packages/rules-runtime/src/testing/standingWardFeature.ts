import type { PathLifecycleReturnsOn } from '@artificer-toolkit/shared/core'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import { SRD_ABILITY_DEFINITION_IDS } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { testUuid } from './dnd5eSrdEncounter.js'

export const STANDING_WARD_FEATURE_ID = testUuid(0x5d1)
export const STANDING_WARD_EFFECT_ID = testUuid(0x5d2)

/**
 * A homebrew passive ward with no duration: attackers save against 8 + Wisdom modifier +
 * proficiency bonus before they may target its holder. It ends when its holder attacks or casts
 * a spell at an enemy, and the given rest turns it back on.
 */
export function standingWardFeature(returnsOn: PathLifecycleReturnsOn): FeatureAuthored {
  return {
    id: STANDING_WARD_FEATURE_ID,
    label: 'Standing Ward',
    description: 'Attackers must save before they target you, until you attack an enemy.',
    availableAtLevel: 1,
    order: 1,
    effects: [
      {
        id: STANDING_WARD_EFFECT_ID,
        order: 1,
        invocation: {
          kind: 'PASSIVE',
          triggerCode: 'ACTIVATED',
          range: { id: testUuid(0x5d3), rangeKind: 'SELF' },
          targeting: { selectionKind: 'SELF' }
        },
        paths: [
          {
            id: testUuid(0x5d4),
            order: 1,
            pathCode: 'ON_USE',
            groupType: 'SINGLE',
            originKind: 'SOURCE',
            selectionKind: 'FIXED',
            resultBlock: {
              id: testUuid(0x5d5),
              resultKind: 'SINGLE',
              lifecycle: {
                endOnTriggers: [
                  { event: 'ACTION_TRAIT', trait: 'ATTACK_ROLL', against: 'ENEMY' },
                  { event: 'ACTION_TRAIT', trait: 'SPELL_CAST', against: 'ENEMY' }
                ],
                returnsOn
              },
              outcomes: [
                {
                  id: testUuid(0x5d6),
                  effectKind: 'APPLY_GRANT',
                  grants: {
                    modifiers: [
                      {
                        id: testUuid(0x5d7),
                        grantKind: 'MODIFIER_GRANT',
                        valueDomainCode: 'INCOMING_ATTACK_GATE',
                        domain: {},
                        modifierKind: 'ENABLE',
                        payload: {
                          savingThrow: {
                            id: testUuid(0x5d8),
                            dcMethod: 'DERIVED_DC',
                            abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.WISDOM,
                            baseDc: 8,
                            bonuses: [
                              {
                                id: testUuid(0x5d9),
                                bonusKind: 'ABILITY_MODIFIER',
                                abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.WISDOM
                              },
                              { id: testUuid(0x5da), bonusKind: 'PROFICIENCY_BONUS' }
                            ]
                          }
                        },
                        scope: 'GLOBAL',
                        selectionKind: 'GRANTED',
                        order: 1
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      }
    ]
  }
}
