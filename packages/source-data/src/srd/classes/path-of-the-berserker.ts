import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import {
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  CLASS_CATEGORY,
  CLOSED_RULE_KIND,
  DURATION_KIND,
  EFFECT_KIND,
  GRANT_KIND,
  MANUAL_ADJUDICATION_REASON,
  MEASUREMENT_UNIT_CODE,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  type ClassAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SUBCLASS_IDS } from '../ids.js'
import { SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'
import { conditionTypeId } from '../equipment/shared.js'
import { RAGE_EFFECT_ID } from './barbarian.js'
import { closedRuleEffect, gmRulingEffect } from './mechanics.js'

function classRowId(classIndex: number, group: number, entry: number): string {
  const xx = classIndex.toString(16).padStart(2, '0')
  const gg = group.toString(16).padStart(2, '0')
  const nn = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-c0${xx}-${gg}${nn}00000000`
}

const B = 1

export const pathOfTheBerserker: ClassAuthored = {
  id: SUBCLASS_IDS.BERSERKER,
  label: 'Path of the Berserker',
  category: CLASS_CATEGORY.SUBCLASS,
  parentClassId: CLASS_IDS.BARBARIAN,
  description:
    "For some barbarians, rage is a means to an end- that end being violence. The Path of the Berserker is a path of untrammeled fury, slick with blood. As you enter the berserker's rage, you thrill in the chaos of battle, heedless of your own health or well-being.",
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: classRowId(B, 11, 1),
      label: 'Frenzy',
      description:
        'Starting when you choose this path at 3rd level, you can go into a frenzy when you rage. If you do so, for the duration of your rage you can make a single melee weapon attack as a bonus action on each of your turns after this one. When your rage ends, you suffer one level of exhaustion (as described in appendix PH-A).',
      availableAtLevel: 3,
      order: 0,
      effects: [
        closedRuleEffect({
          id: classRowId(B, 20, 1),
          invocation: {
            kind: 'ACTION',
            triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: ACTIVATION_CODE.BONUS_ACTION, amount: 1 },
            range: { id: classRowId(B, 21, 1), rangeKind: RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: 'ANY'
            }
          },
          pathCode: PATH_CODE.ON_ATTACK,
          ruleKind: CLOSED_RULE_KIND.CLASS_BERSERKER_FRENZY
        })
      ]
    },
    {
      id: classRowId(B, 11, 2),
      label: 'Mindless Rage',
      description:
        "Beginning at 6th level, you can't be charmed or frightened while raging. If you are charmed or frightened when you enter your rage, the effect is suspended for the duration of the rage.",
      availableAtLevel: 6,
      order: 1,
      grants: {
        modifiers: (['CHARMED', 'FRIGHTENED'] as const).map((condition, index) => ({
          id: classRowId(B, 0xa0, index + 1),
          grantKind: GRANT_KIND.MODIFIER_GRANT,
          valueDomainCode: VALUE_DOMAIN_CODE.CONDITION_IMMUNITY,
          domain: {},
          modifierKind: MODIFIER_KIND.ADD_OPTION,
          scope: MODIFIER_SCOPE_KIND.GLOBAL,
          selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
          payload: { conditionTypeId: conditionTypeId(condition) },
          order: index,
          restrictions: {
            id: classRowId(B, 0xa1 + index, 0),
            groups: [
              {
                id: classRowId(B, 0xa1 + index, 1),
                order: 0,
                contexts: [
                  {
                    id: classRowId(B, 0xa1 + index, 2),
                    order: 0,
                    subject: 'CHARACTER' as const,
                    conditions: [
                      {
                        id: classRowId(B, 0xa1 + index, 3),
                        order: 0,
                        kind: 'PREDICATE' as const,
                        constraint: 'INCLUDE' as const,
                        predicateCode: 'HOLDER_ACTIVE_EFFECT' as const,
                        effectIds: [RAGE_EFFECT_ID]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        }))
      },
      // The engine does not suspend a condition already on the holder, so that clause is a GM ruling (D187a).
      effects: [
        gmRulingEffect({
          ids: {
            effect: classRowId(B, 20, 2),
            range: classRowId(B, 21, 2),
            path: classRowId(B, 0xa4, 1),
            result: classRowId(B, 0xa4, 2),
            outcome: classRowId(B, 0xa4, 3)
          },
          label: 'Mindless Rage',
          instructions:
            'If you are charmed or frightened when you enter your rage, the effect is suspended for the duration of the rage. The GM ignores the condition until the rage ends.',
          reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE
        })
      ]
    },
    {
      id: classRowId(B, 11, 3),
      label: 'Intimidating Presence',
      description:
        "Beginning at 10th level, you can use your action to frighten someone with your menacing presence. When you do so, choose one creature that you can see within 30 feet of you. If the creature can see or hear you, it must succeed on a Wisdom saving throw (DC equal to 8 + your proficiency bonus + your Charisma modifier) or be frightened of you until the end of your next turn. On subsequent turns, you can use your action to extend the duration of this effect on the frightened creature until the end of your next turn. This effect ends if the creature ends its turn out of line of sight or more than 60 feet away from you. If the creature succeeds on its saving throw, you can't use this feature on that creature again for 24 hours.",
      availableAtLevel: 10,
      order: 2,
      effects: [
        {
          id: classRowId(B, 20, 3),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: TRIGGER.SAVING_THROW,
            savingThrow: {
              id: classRowId(B, 25, 1),
              dcMethod: 'DERIVED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM,
              baseDc: 8,
              bonuses: [
                {
                  id: classRowId(B, 26, 1),
                  bonusKind: 'ABILITY_MODIFIER',
                  abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CHARISMA
                },
                {
                  id: classRowId(B, 26, 2),
                  bonusKind: 'PROFICIENCY_BONUS'
                }
              ]
            },
            activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: classRowId(B, 21, 3),
              rangeKind: RANGE_KIND.DISTANCE,
              amount: 30,
              unit: MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: 'ANY'
            }
          },
          paths: [
            {
              id: classRowId(B, 27, 3),
              order: 1,
              pathCode: PATH_CODE.ON_SAVE_FAIL,
              groupType: PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${classRowId(B, 27, 3)}__result`,
                resultKind: 'SINGLE',
                // "Frightened of you until the end of your next turn." Extending it with an action and
                // ending it beyond 60 feet or out of sight are future enhancements (D156).
                duration: {
                  id: classRowId(B, 0x90, 1),
                  durationKind: DURATION_KIND.ROUND,
                  amount: 1
                },
                lifecycle: { turnAnchor: { actor: 'SOURCE', boundary: 'END_OF_TURN' } },
                outcomes: [
                  {
                    id: classRowId(B, 29, 5),
                    effectKind: EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('FRIGHTENED'),
                    recordsSource: true
                  }
                ]
              }
            },
            {
              id: classRowId(B, 28, 3),
              order: 2,
              pathCode: PATH_CODE.ON_SAVE_SUCCESS,
              groupType: PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${classRowId(B, 28, 3)}__result`,
                resultKind: 'SINGLE',
                // "You can't use this feature on that creature again for 24 hours."
                duration: {
                  id: classRowId(B, 0x90, 2),
                  durationKind: DURATION_KIND.HOUR,
                  amount: 24
                },
                outcomes: [{ id: classRowId(B, 29, 6), effectKind: EFFECT_KIND.SOURCE_IMMUNITY }]
              }
            }
          ]
        }
      ]
    },
    {
      id: classRowId(B, 11, 4),
      label: 'Retaliation',
      description:
        'Starting at 14th level, when you take damage from a creature that is within 5 feet of you, you can use your reaction to make a melee weapon attack against that creature.',
      availableAtLevel: 14,
      order: 3,
      effects: [
        closedRuleEffect({
          id: classRowId(B, 20, 4),
          invocation: {
            kind: 'ACTION',
            triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: ACTIVATION_CODE.REACTION, amount: 1 },
            range: {
              id: classRowId(B, 21, 4),
              rangeKind: RANGE_KIND.DISTANCE,
              amount: 5,
              unit: MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: 'ANY'
            }
          },
          pathCode: PATH_CODE.ON_ATTACK,
          ruleKind: CLOSED_RULE_KIND.CLASS_BERSERKER_RETALIATION
        })
      ]
    }
  ]
}
