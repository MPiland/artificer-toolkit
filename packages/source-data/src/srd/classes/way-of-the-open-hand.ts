import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import {
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  CLOSED_RULE_KIND,
  DURATION_KIND,
  FOLLOW_UP_SAVE_TIMING,
  MEASUREMENT_UNIT_CODE,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PATH_CODE,
  PATH_LIFECYCLE_RETURNS_ON,
  PATH_GROUP_TYPE,
  CLASS_CATEGORY,
  EFFECT_KIND,
  RANGE_KIND,
  SCALING,
  TARGET_SELECTION_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  type ClassAuthored,
  type ResultBlockAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SUBCLASS_IDS } from '../ids.js'
import { SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'
import { conditionTypeId } from '../equipment/shared.js'
import { closedRuleEffect } from './mechanics.js'
import { FLURRY_OF_BLOWS_EFFECT_ID } from './monk.js'
function classRowId(classIndex: number, group: number, entry: number): string {
  const xx = classIndex.toString(16).padStart(2, '0')
  const gg = group.toString(16).padStart(2, '0')
  const nn = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-c0${xx}-${gg}${nn}00000000`
}
const M = 6

type TechniqueResult = Pick<ResultBlockAuthored, 'duration' | 'lifecycle' | 'outcomes'>

/**
 * A save against the Monk's ki save DC (8 + proficiency + Wisdom) whose failure imposes
 * `onFailure`; `index` is the technique's slot, and it names every row the save owns.
 */
function techniqueSave(
  index: number,
  abilityDefinitionId: string,
  onFailure: ResultBlockAuthored['outcomes']
): ResultBlockAuthored['outcomes'] {
  return [
    {
      id: classRowId(M, 29, 20 + index),
      effectKind: EFFECT_KIND.FOLLOW_UP_SAVE,
      timing: FOLLOW_UP_SAVE_TIMING.IMMEDIATE,
      savingThrow: {
        id: classRowId(M, 25, 3 + index),
        dcMethod: 'DERIVED_DC',
        abilityDefinitionId,
        baseDc: 8,
        bonuses: [
          {
            id: classRowId(M, 30, 2 * index),
            bonusKind: 'ABILITY_MODIFIER',
            abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM
          },
          { id: classRowId(M, 30, 2 * index + 1), bonusKind: 'PROFICIENCY_BONUS' }
        ]
      },
      attempts: { kind: 'ONCE' },
      onSuccess: { kind: 'END' },
      onFailure: { kind: 'OUTCOMES', endCurrent: false, resultKind: 'SINGLE', outcomes: onFailure }
    }
  ]
}

/**
 * What the Monk may impose on the target of a Flurry of Blows hit, one at a time. Each is an
 * ordinary `ON_HIT` Effect of this Feature that a `GRANTED_ACTION_OPTION` modifier names.
 */
const OPEN_HAND_TECHNIQUES: readonly { label: string; result: TechniqueResult }[] = [
  {
    label: 'Knock prone',
    result: {
      outcomes: techniqueSave(0, SRD_EFFECT_ABILITY_DEFINITION_IDS.DEXTERITY, [
        {
          id: classRowId(M, 29, 10),
          effectKind: EFFECT_KIND.CONDITION,
          conditionId: conditionTypeId('PRONE')
        }
      ])
    }
  },
  {
    label: 'Push 15 feet',
    result: {
      outcomes: techniqueSave(1, SRD_EFFECT_ABILITY_DEFINITION_IDS.STRENGTH, [
        {
          id: classRowId(M, 29, 11),
          effectKind: EFFECT_KIND.FORCED_MOVEMENT,
          direction: 'AWAY_FROM_SOURCE',
          actionEconomy: 'NONE',
          // As the Charge riders do: the app moves the target the whole distance unless blocked.
          distanceMode: 'EXACT',
          amount: 15,
          unit: MEASUREMENT_UNIT_CODE.FEET
        }
      ])
    }
  },
  {
    label: 'No reactions',
    result: {
      // "Until the end of your next turn" counts the Monk's turns, as Stunning Strike does.
      duration: { id: classRowId(M, 30, 10), durationKind: DURATION_KIND.ROUND, amount: 1 },
      lifecycle: { turnAnchor: { actor: 'SOURCE', boundary: 'END_OF_TURN' } },
      outcomes: [
        {
          id: classRowId(M, 29, 12),
          effectKind: EFFECT_KIND.APPLY_GRANT,
          grants: {
            modifiers: [
              {
                id: classRowId(M, 28, 13),
                grantKind: GRANT_KIND.MODIFIER_GRANT,
                valueDomainCode: VALUE_DOMAIN_CODE.REACTION_COUNT,
                domain: {},
                modifierKind: MODIFIER_KIND.SET_VALUE,
                payload: { amount: 0 },
                scope: MODIFIER_SCOPE_KIND.GLOBAL,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                order: 1
              }
            ]
          }
        }
      ]
    }
  }
]

export const wayOfTheOpenHand: ClassAuthored = {
  id: SUBCLASS_IDS.OPEN_HAND,
  label: 'Way of the Open Hand',
  category: CLASS_CATEGORY.SUBCLASS,
  parentClassId: CLASS_IDS.MONK,
  description:
    'Monks of the Way of the Open Hand are the ultimate masters of martial arts combat, whether armed or unarmed. They learn techniques to push and trip their opponents, manipulate ki to heal damage to their bodies, and practice advanced meditation that can protect them from harm.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: classRowId(M, 11, 1),
      label: 'Open Hand Technique',
      description:
        "Starting when you choose this tradition at 3rd level, you can manipulate your enemy's ki when you harness your own. Whenever you hit a creature with one of the attacks granted by your Flurry of Blows, you can impose one of the following effects on that target:\n* It must succeed on a Dexterity saving throw or be knocked prone.\n* It must make a Strength saving throw. If it fails, you can push it up to 15 feet away from you.\n* It can't take reactions until the end of your next turn.",
      availableAtLevel: 3,
      order: 0,
      // Each option is a free optional rider of the strikes Flurry of Blows grants (one per hit).
      grants: {
        modifiers: OPEN_HAND_TECHNIQUES.map(({ label }, index) => ({
          id: classRowId(M, 28, 10 + index),
          grantKind: GRANT_KIND.MODIFIER_GRANT,
          valueDomainCode: VALUE_DOMAIN_CODE.GRANTED_ACTION_OPTION,
          domain: { grantedByEffectId: FLURRY_OF_BLOWS_EFFECT_ID },
          modifierKind: MODIFIER_KIND.ADD_OPTION,
          payload: { optionEffectId: classRowId(M, 20, 5 + index), label },
          scope: MODIFIER_SCOPE_KIND.GLOBAL,
          selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
          order: index
        }))
      },
      effects: OPEN_HAND_TECHNIQUES.map(({ result }, index) => ({
        id: classRowId(M, 20, 5 + index),
        order: index,
        invocation: {
          kind: 'PASSIVE' as const,
          triggerCode: TRIGGER.UNARMED_ATTACK,
          range: { id: classRowId(M, 21, 5 + index), rangeKind: RANGE_KIND.SPECIAL },
          targeting: {
            selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
            dispositionKind: 'ANY' as const
          }
        },
        paths: [
          {
            id: classRowId(M, 27, 5 + index),
            order: 1,
            pathCode: PATH_CODE.ON_HIT,
            groupType: PATH_GROUP_TYPE.SINGLE,
            originKind: 'SOURCE' as const,
            selectionKind: 'FIXED' as const,
            resultBlock: {
              id: `${classRowId(M, 27, 5 + index)}__result`,
              resultKind: 'SINGLE' as const,
              ...result
            }
          }
        ]
      }))
    },
    {
      id: classRowId(M, 11, 2),
      label: 'Wholeness of Body',
      description:
        'At 6th level, you gain the ability to heal yourself. As an action, you can regain hit points equal to three times your monk level. You must finish a long rest before you can use this feature again.',
      availableAtLevel: 6,
      order: 1,
      attributes: ['LIMITED_USE'],
      charges: {
        id: classRowId(M, 11, 20),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: SCALING.NONE,
        resetKind: 'LONG_REST',
        amount: 1
      },
      effects: [
        {
          id: classRowId(M, 11, 21),
          order: 0,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: TRIGGER.ACTIVATED,
            resourceUse: { chargeId: classRowId(M, 11, 20), cost: 1 },
            activation: {
              code: ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: classRowId(M, 11, 22),
              rangeKind: RANGE_KIND.SELF
            },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SELF
            }
          },
          paths: [
            {
              id: classRowId(M, 11, 23),
              order: 1,
              pathCode: PATH_CODE.ON_USE,
              groupType: PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: classRowId(M, 11, 23) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: classRowId(M, 0x6d, 1),
                    effectKind: EFFECT_KIND.HEAL,
                    valueKind: 'FIXED',
                    amount: 0,
                    scalingKind: SCALING.NONE,
                    bonuses: [
                      {
                        id: classRowId(M, 11, 24),
                        bonusKind: 'CLASS_LEVEL',
                        classId: CLASS_IDS.MONK,
                        multiplier: 3,
                        order: 0
                      }
                    ]
                  }
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: classRowId(M, 11, 3),
      label: 'Tranquility',
      description:
        'Beginning at 11th level, you can enter a special meditation that surrounds you with an aura of peace. At the end of a long rest, you gain the effect of a sanctuary spell that lasts until the start of your next long rest (the spell can end early as normal). The saving throw DC for the spell equals 8 + your Wisdom modifier + your proficiency bonus.',
      availableAtLevel: 11,
      order: 2,
      effects: [
        {
          id: classRowId(M, 20, 2),
          order: 1,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.ACTIVATED,
            range: { id: classRowId(M, 21, 2), rangeKind: RANGE_KIND.SELF },
            targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
          },
          paths: [
            {
              id: classRowId(M, 27, 2),
              order: 1,
              pathCode: PATH_CODE.ON_USE,
              groupType: PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${classRowId(M, 27, 2)}__result`,
                resultKind: 'SINGLE',
                // Sanctuary from long rest to long rest: it ends early as the spell does.
                lifecycle: {
                  endTriggers: [
                    { event: 'ACTION_TRAIT', trait: 'ATTACK_ROLL', against: 'ENEMY' },
                    { event: 'ACTION_TRAIT', trait: 'SPELL_CAST', against: 'ENEMY' }
                  ],
                  returnsOn: PATH_LIFECYCLE_RETURNS_ON.LONG_REST
                },
                outcomes: [
                  {
                    id: classRowId(M, 29, 3),
                    effectKind: EFFECT_KIND.APPLY_GRANT,
                    grants: {
                      modifiers: [
                        {
                          id: classRowId(M, 28, 3),
                          grantKind: GRANT_KIND.MODIFIER_GRANT,
                          valueDomainCode: VALUE_DOMAIN_CODE.INCOMING_ATTACK_GATE,
                          domain: {},
                          modifierKind: MODIFIER_KIND.ENABLE,
                          payload: {
                            savingThrow: {
                              id: classRowId(M, 25, 1),
                              dcMethod: 'DERIVED_DC',
                              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM,
                              baseDc: 8,
                              bonuses: [
                                {
                                  id: classRowId(M, 26, 1),
                                  bonusKind: 'ABILITY_MODIFIER',
                                  abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM
                                },
                                {
                                  id: classRowId(M, 26, 2),
                                  bonusKind: 'PROFICIENCY_BONUS'
                                }
                              ]
                            }
                          },
                          scope: MODIFIER_SCOPE_KIND.GLOBAL,
                          selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
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
    },
    {
      id: classRowId(M, 11, 4),
      label: 'Quivering Palm',
      description:
        "At 17th level, you gain the ability to set up lethal vibrations in someone's body. When you hit a creature with an unarmed strike, you can spend 3 ki points to start these imperceptible vibrations, which last for a number of days equal to your monk level. The vibrations are harmless unless you use your action to end them. To do so, you and the target must be on the same plane of existence. When you use this action, the creature must make a Constitution saving throw. If it fails, it is reduced to 0 hit points. If it succeeds, it takes 10d10 necrotic damage. You can have only one creature under the effect of this feature at a time. You can choose to end the vibrations harmlessly without using an action.",
      availableAtLevel: 17,
      order: 3,
      effects: [
        closedRuleEffect({
          id: classRowId(M, 20, 3),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.UNARMED_ATTACK,
            range: { id: classRowId(M, 21, 3), rangeKind: RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: 'ANY'
            }
          },
          pathCode: PATH_CODE.ON_HIT,
          ruleKind: CLOSED_RULE_KIND.CLASS_WAY_OF_THE_OPEN_HAND_QUIVERING_PALM
        }),
        {
          id: classRowId(M, 20, 4),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: TRIGGER.SAVING_THROW,
            savingThrow: {
              id: classRowId(M, 25, 2),
              dcMethod: 'DERIVED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION,
              baseDc: 8,
              bonuses: [
                {
                  id: classRowId(M, 26, 3),
                  bonusKind: 'ABILITY_MODIFIER',
                  abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM
                },
                {
                  id: classRowId(M, 26, 4),
                  bonusKind: 'PROFICIENCY_BONUS'
                }
              ]
            },
            activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: classRowId(M, 21, 4), rangeKind: RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: 'ANY'
            }
          },
          paths: [
            {
              id: classRowId(M, 27, 4),
              order: 1,
              pathCode: PATH_CODE.ON_SAVE_FAIL,
              groupType: PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${classRowId(M, 27, 4)}__result`,
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: classRowId(M, 29, 7),
                    effectKind: EFFECT_KIND.CLOSED_RULE,
                    ruleKind: CLOSED_RULE_KIND.CLASS_WAY_OF_THE_OPEN_HAND_QUIVERING_PALM
                  }
                ]
              }
            },
            {
              id: classRowId(M, 28, 4),
              order: 2,
              pathCode: PATH_CODE.ON_SAVE_SUCCESS,
              groupType: PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${classRowId(M, 28, 4)}__result`,
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: classRowId(M, 29, 8),
                    effectKind: EFFECT_KIND.CLOSED_RULE,
                    ruleKind: CLOSED_RULE_KIND.CLASS_WAY_OF_THE_OPEN_HAND_QUIVERING_PALM
                  }
                ]
              }
            }
          ]
        }
      ]
    }
  ]
}
