import {
  ACTIVATION_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  CLASS_CATEGORY,
  CLOSED_RULE_KIND,
  GRANT_KIND,
  MEASUREMENT_UNIT_CODE,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PATH_CODE,
  RANGE_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  type ClassAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SUBCLASS_IDS } from '../ids.js'
import { SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'
import {
  attackingItemPropertyRestriction,
  closedRuleEffect,
  duelingRestriction
} from './mechanics.js'

function classRowId(classIndex: number, group: number, entry: number): string {
  const xx = classIndex.toString(16).padStart(2, '0')
  const gg = group.toString(16).padStart(2, '0')
  const nn = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-c0${xx}-${gg}${nn}00000000`
}

const F = 5

export const championMartialArchetype: ClassAuthored = {
  id: SUBCLASS_IDS.CHAMPION,
  label: 'Champion',
  category: CLASS_CATEGORY.SUBCLASS,
  parentClassId: CLASS_IDS.FIGHTER,
  description:
    'The archetypal Champion focuses on the development of raw physical power honed to deadly perfection. Those who model themselves on this archetype combine rigorous training with physical excellence to deal devastating blows.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: classRowId(F, 11, 1),
      label: 'Improved Critical',
      description:
        'Beginning when you choose this archetype at 3rd level, your weapon attacks score a critical hit on a roll of 19 or 20.',
      availableAtLevel: 3,
      order: 0,
      effects: [
        closedRuleEffect({
          id: classRowId(F, 20, 1),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
            range: { id: classRowId(F, 21, 1), rangeKind: RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: 'ANY'
            }
          },
          pathCode: PATH_CODE.ON_ATTACK,
          ruleKind: CLOSED_RULE_KIND.CLASS_CHAMPION_IMPROVED_CRITICAL
        }),
        closedRuleEffect({
          id: classRowId(F, 20, 9),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.RANGED_WEAPON_ATTACK,
            range: { id: classRowId(F, 21, 9), rangeKind: RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: 'ANY'
            }
          },
          pathCode: PATH_CODE.ON_ATTACK,
          ruleKind: CLOSED_RULE_KIND.CLASS_CHAMPION_IMPROVED_CRITICAL
        })
      ]
    },
    {
      id: classRowId(F, 11, 2),
      label: 'Remarkable Athlete',
      description:
        "Starting at 7th level, you can add half your proficiency bonus (round up) to any Strength, Dexterity, or Constitution check you make that doesn't already use your proficiency bonus. In addition, when you make a running long jump, the distance you can cover increases by a number of feet equal to your Strength modifier.",
      availableAtLevel: 7,
      order: 1,
      effects: [
        closedRuleEffect({
          id: classRowId(F, 20, 2),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.ACTIVATED,
            range: { id: classRowId(F, 21, 2), rangeKind: RANGE_KIND.SELF },
            targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: CLOSED_RULE_KIND.CLASS_CHAMPION_REMARKABLE_ATHLETE
        })
      ]
    },
    {
      id: classRowId(F, 11, 3),
      label: 'Additional Fighting Style',
      description:
        'At 10th level, you can choose a second option from the Fighting Style class feature.',
      availableAtLevel: 10,
      order: 2,
      optionChoices: [{ level: 10, count: 1 }],
      options: [
        {
          id: classRowId(F, 0x22, 1),
          label: 'Archery',
          description: 'You gain a +2 bonus to attack rolls you make with ranged weapons.',
          grants: {
            modifiers: [
              {
                id: classRowId(F, 0x22, 10),
                grantKind: GRANT_KIND.MODIFIER_GRANT,
                valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
                domain: { attackDomain: 'RANGED' as const },
                modifierKind: MODIFIER_KIND.BONUS,
                scope: MODIFIER_SCOPE_KIND.GLOBAL,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                payload: { valueKind: 'FIXED' as const, amount: 2 },
                order: 0,
                // Ranged weapons only; a thrown melee weapon makes a ranged attack but is not one.
                restrictions: attackingItemPropertyRestriction(
                  (entry) => classRowId(F, 0x7a, 0x30 + entry),
                  [{ constraint: 'INCLUDE', properties: ['RANGED'] }]
                )
              }
            ]
          },
          order: 0
        },
        {
          id: classRowId(F, 0x22, 2),
          label: 'Defense',
          description: 'While you are wearing armor, you gain a +1 bonus to AC.',
          grants: {
            modifiers: [
              {
                id: classRowId(F, 0x22, 11),
                grantKind: GRANT_KIND.MODIFIER_GRANT,
                valueDomainCode: VALUE_DOMAIN_CODE.ARMOR_CLASS,
                domain: {},
                modifierKind: MODIFIER_KIND.BONUS,
                scope: MODIFIER_SCOPE_KIND.GLOBAL,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                payload: { valueKind: 'FIXED' as const, amount: 1 },
                order: 0,
                restrictions: {
                  id: classRowId(F, 23, 1),
                  groups: [
                    {
                      id: classRowId(F, 23, 2),
                      order: 1,
                      contexts: [
                        {
                          id: classRowId(F, 23, 3),
                          order: 1,
                          subject: 'CHARACTER',
                          conditions: [
                            {
                              id: classRowId(F, 23, 4),
                              order: 1,
                              kind: 'PREDICATE',
                              constraint: 'INCLUDE',
                              predicateCode: 'EQUIPMENT_EQUIPPED',
                              authoringModeKind: AUTHORING_MODE_KIND.ALL,
                              category: 'ARMOR'
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              }
            ]
          },
          order: 1
        },
        {
          id: classRowId(F, 0x22, 3),
          label: 'Dueling',
          description:
            'When you are wielding a melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.',
          grants: {
            modifiers: [
              {
                id: classRowId(F, 0x22, 12),
                grantKind: GRANT_KIND.MODIFIER_GRANT,
                valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
                domain: { attackDomain: 'MELEE' as const },
                modifierKind: MODIFIER_KIND.BONUS,
                scope: MODIFIER_SCOPE_KIND.GLOBAL,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                payload: { valueKind: 'FIXED' as const, amount: 2 },
                order: 0,
                restrictions: duelingRestriction((entry) => classRowId(F, 0x7a, 0x38 + entry))
              }
            ]
          },
          order: 2,
          effects: [
            closedRuleEffect({
              id: classRowId(F, 20, 3),
              invocation: {
                kind: 'PASSIVE',
                triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
                range: { id: classRowId(F, 21, 3), rangeKind: RANGE_KIND.SPECIAL },
                targeting: {
                  selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                  dispositionKind: 'ANY'
                }
              },
              pathCode: PATH_CODE.ON_HIT,
              ruleKind: CLOSED_RULE_KIND.CLASS_CHAMPION_DUELING
            })
          ]
        },
        {
          id: classRowId(F, 0x22, 4),
          label: 'Great Weapon Fighting',
          description:
            'When you roll a 1 or 2 on a damage die for an attack you make with a melee weapon that you are wielding with two hands, you can reroll the die and must use the new roll, even if the new roll is a 1 or a 2. The weapon must have the two-handed or versatile property for you to gain this benefit.',
          order: 3,
          effects: [
            closedRuleEffect({
              id: classRowId(F, 20, 4),
              invocation: {
                kind: 'PASSIVE',
                triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
                range: { id: classRowId(F, 21, 4), rangeKind: RANGE_KIND.SPECIAL },
                targeting: {
                  selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                  dispositionKind: 'ANY'
                }
              },
              pathCode: PATH_CODE.ON_HIT,
              ruleKind: CLOSED_RULE_KIND.CLASS_CHAMPION_GREAT_WEAPON_FIGHTING
            })
          ]
        },
        {
          id: classRowId(F, 0x22, 5),
          label: 'Protection',
          description:
            'When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll. You must be wielding a shield.',
          order: 4,
          effects: [
            closedRuleEffect({
              id: classRowId(F, 20, 5),
              invocation: {
                kind: 'ACTION',
                triggerCode: TRIGGER.ACTIVATED,
                activation: { code: ACTIVATION_CODE.REACTION, amount: 1 },
                range: {
                  id: classRowId(F, 21, 5),
                  rangeKind: RANGE_KIND.DISTANCE,
                  amount: 5,
                  unit: MEASUREMENT_UNIT_CODE.FEET
                },
                targeting: {
                  selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                  dispositionKind: 'ANY',
                  self: 'WARN'
                }
              },
              ruleKind: CLOSED_RULE_KIND.CLASS_CHAMPION_PROTECTION
            })
          ]
        },
        {
          id: classRowId(F, 0x22, 6),
          label: 'Two-Weapon Fighting',
          description:
            'When you engage in two-weapon fighting, you can add your ability modifier to the damage of the second attack.',
          order: 5,
          effects: [
            closedRuleEffect({
              id: classRowId(F, 20, 6),
              invocation: {
                kind: 'PASSIVE',
                triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
                range: { id: classRowId(F, 21, 6), rangeKind: RANGE_KIND.SPECIAL },
                targeting: {
                  selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                  dispositionKind: 'ANY'
                }
              },
              pathCode: PATH_CODE.ON_HIT,
              ruleKind: CLOSED_RULE_KIND.CLASS_CHAMPION_TWO_WEAPON_FIGHTING
            })
          ]
        }
      ]
    },
    {
      id: classRowId(F, 11, 4),
      label: 'Superior Critical',
      description:
        'Starting at 15th level, your weapon attacks score a critical hit on a roll of 18-20.',
      availableAtLevel: 15,
      order: 3,
      effects: [
        closedRuleEffect({
          id: classRowId(F, 20, 7),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
            range: { id: classRowId(F, 21, 7), rangeKind: RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: 'ANY'
            }
          },
          pathCode: PATH_CODE.ON_ATTACK,
          ruleKind: CLOSED_RULE_KIND.CLASS_CHAMPION_SUPERIOR_CRITICAL
        }),
        closedRuleEffect({
          id: classRowId(F, 20, 10),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.RANGED_WEAPON_ATTACK,
            range: { id: classRowId(F, 21, 10), rangeKind: RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: 'ANY'
            }
          },
          pathCode: PATH_CODE.ON_ATTACK,
          ruleKind: CLOSED_RULE_KIND.CLASS_CHAMPION_SUPERIOR_CRITICAL
        })
      ]
    },
    {
      id: classRowId(F, 11, 5),
      label: 'Survivor',
      description:
        "At 18th level, you attain the pinnacle of resilience in battle. At the start of each of your turns, you regain hit points equal to 5 + your Constitution modifier if you have no more than half of your hit points left. You don't gain this benefit if you have 0 hit points.",
      availableAtLevel: 18,
      order: 4,
      effects: [
        closedRuleEffect({
          id: classRowId(F, 20, 8),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.ACTIVATED,
            range: { id: classRowId(F, 21, 8), rangeKind: RANGE_KIND.SELF },
            targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: CLOSED_RULE_KIND.CLASS_CHAMPION_SURVIVOR
        })
      ]
    }
  ]
}
