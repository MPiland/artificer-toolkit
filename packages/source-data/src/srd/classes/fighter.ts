import { ABILITY_CODE } from '../vocabulary.js'
import {
  ACTIVATION_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_DUPLICATE_POLICY,
  AUTHORING_SELECTION_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CLASS_CATEGORY,
  CLOSED_RULE_KIND,
  EFFECT_KIND,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  FEATURE_ATTRIBUTE,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  MEASUREMENT_UNIT_CODE,
  PROFICIENCY_KIND,
  MANUAL_ADJUDICATION_REASON,
  RANGE_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  STARTING_EQUIPMENT_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  type ActivationCode,
  type ClassAuthored,
  type ClosedRuleKind,
  type EffectAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS } from '../ids.js'
import { SRD_CURRENCIES, SRD_SKILLS, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'
import {
  abilityScoreImprovementOptions,
  attackingItemPropertyRestriction,
  attacksPerAttackActionGrant,
  closedRuleEffect,
  duelingRestriction,
  gmRulingEffect,
  twoWeaponFightingGrants,
  equippedCategoryRestriction
} from './mechanics.js'
function skillId(code: string): string {
  const entry = SRD_SKILLS.find((s) => s.code === code)
  if (!entry) throw new Error(`SRD skill vocabulary entry for ${code} required.`)
  return entry.id
}
const goldCurrencyId = SRD_CURRENCIES.find((c) => c.code === 'GP')?.id
if (!goldCurrencyId) throw new Error('SRD GP currency required.')
function classRowId(classIndex: number, group: number, entry: number): string {
  const xx = classIndex.toString(16).padStart(2, '0')
  const gg = group.toString(16).padStart(2, '0')
  const nn = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-c0${xx}-${gg}${nn}00000000`
}
function equipmentId(index: number): string {
  const hex = index.toString(16).padStart(4, '0')
  return `00000000-0000-0000-0060-${hex}00000000`
}
const F = 5 // Fighter class index
const abilityScoreImprovementDescription =
  "When you reach 4th level, and again at 6th, 8th, 12th, 14th, 16th, and 19th level, you can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1. As normal, you can't increase an ability score above 20 using this feature."

function selfClassRuleEffect(
  entry: number,
  ruleKind: ClosedRuleKind,
  activationCode?: Exclude<ActivationCode, 'FREE'>
): EffectAuthored {
  const range = { id: classRowId(F, 0x69, entry), rangeKind: RANGE_KIND.SELF } as const
  return closedRuleEffect({
    id: classRowId(F, 0x60, entry),
    ruleKind,
    invocation: activationCode
      ? {
          kind: 'ACTION',
          triggerCode: TRIGGER.ACTIVATED,
          activation: { code: activationCode, amount: 1 },
          range,
          targeting: { selectionKind: 'SELF' }
        }
      : {
          kind: 'PASSIVE',
          triggerCode: TRIGGER.ACTIVATED,
          range,
          targeting: { selectionKind: 'SELF' }
        }
  })
}
export const fighter: ClassAuthored = {
  id: CLASS_IDS.FIGHTER,
  label: 'Fighter',
  category: CLASS_CATEGORY.BASE,
  subclassSelectionLevel: 3,
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  hitpoint: {
    ability: ABILITY_CODE.CONSTITUTION,
    dieConfig: 'd10'
  },
  startingGold: {
    multiplier: 10,
    currencyId: goldCurrencyId,
    dieConfig: '5d4'
  },
  multiclass: {
    id: classRowId(F, 99, 1),
    requirementGroups: {
      groups: [
        {
          id: classRowId(F, 99, 2),
          requirements: [{ id: classRowId(F, 99, 3), ability: ABILITY_CODE.STRENGTH, min: 13 }]
        },
        {
          id: classRowId(F, 99, 4),
          requirements: [{ id: classRowId(F, 99, 5), ability: ABILITY_CODE.DEXTERITY, min: 13 }]
        }
      ]
    },
    proficiencies: [
      {
        id: classRowId(F, 99, 6),
        grantKind: GRANT_KIND.PROFICIENCY_GRANT,
        proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
        level: SCALING_AMOUNT_KIND.FULL,
        selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
        scalingKind: SCALING.NONE,
        authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
        properties: ['LIGHT'],
        category: 'ARMOR',
        order: 0
      }
    ]
  },
  startingEquipment: {
    id: classRowId(F, 98, 1),
    sets: [
      {
        id: classRowId(F, 98, 2),
        order: 0,
        groups: [
          {
            id: classRowId(F, 98, 3),
            order: 0,
            options: [
              {
                id: classRowId(F, 98, 4),
                order: 0,
                items: [
                  {
                    id: classRowId(F, 98, 5),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(47)],
                    quantity: 1
                  }
                ]
              },
              {
                id: classRowId(F, 98, 6),
                order: 1,
                items: [
                  {
                    id: classRowId(F, 98, 7),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(39)],
                    quantity: 1
                  },
                  {
                    id: classRowId(F, 98, 8),
                    order: 1,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(36)],
                    quantity: 1
                  },
                  {
                    id: classRowId(F, 98, 9),
                    order: 2,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(99)],
                    quantity: 20
                  }
                ]
              }
            ]
          },
          {
            id: classRowId(F, 98, 10),
            order: 1,
            options: [
              {
                id: classRowId(F, 98, 11),
                order: 0,
                items: [
                  {
                    id: classRowId(F, 98, 12),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
                    authoringModeKind: AUTHORING_MODE_KIND.ALL,
                    category: EQUIPMENT_CATEGORY_CODE.WEAPON,
                    properties: [EQUIPMENT_PROPERTY_CODE.MARTIAL],
                    count: 1
                  },
                  {
                    id: classRowId(F, 98, 13),
                    order: 1,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
                    authoringModeKind: AUTHORING_MODE_KIND.ALL,
                    category: EQUIPMENT_CATEGORY_CODE.SHIELD,
                    count: 1
                  }
                ]
              },
              {
                id: classRowId(F, 98, 14),
                order: 1,
                items: [
                  {
                    id: classRowId(F, 98, 15),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
                    authoringModeKind: AUTHORING_MODE_KIND.ALL,
                    category: EQUIPMENT_CATEGORY_CODE.WEAPON,
                    properties: [EQUIPMENT_PROPERTY_CODE.MARTIAL],
                    count: 2
                  }
                ]
              }
            ]
          },
          {
            id: classRowId(F, 98, 16),
            order: 2,
            options: [
              {
                id: classRowId(F, 98, 17),
                order: 0,
                items: [
                  {
                    id: classRowId(F, 98, 18),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(11)],
                    quantity: 1
                  },
                  {
                    id: classRowId(F, 98, 19),
                    order: 1,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(101)],
                    quantity: 20
                  }
                ]
              },
              {
                id: classRowId(F, 98, 20),
                order: 1,
                items: [
                  {
                    id: classRowId(F, 98, 21),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(4)],
                    quantity: 2
                  }
                ]
              }
            ]
          },
          {
            id: classRowId(F, 98, 22),
            order: 3,
            options: [
              {
                id: classRowId(F, 98, 23),
                order: 0,
                items: [
                  {
                    id: classRowId(F, 98, 24),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(184)],
                    quantity: 1
                  }
                ]
              },
              {
                id: classRowId(F, 98, 25),
                order: 1,
                items: [
                  {
                    id: classRowId(F, 98, 26),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(186)],
                    quantity: 1
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  proficiencies: [
    // All armor
    {
      id: classRowId(F, 2, 1),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      properties: ['LIGHT', 'MEDIUM', 'HEAVY'],
      category: 'ARMOR',
      order: 0
    },
    // Shields
    {
      id: classRowId(F, 2, 2),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.ALL,
      category: 'SHIELD',
      order: 1
    },
    // Simple weapons
    {
      id: classRowId(F, 2, 3),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      properties: ['SIMPLE'],
      category: 'WEAPON',
      order: 2
    },
    // Martial weapons
    {
      id: classRowId(F, 2, 4),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      properties: ['MARTIAL'],
      category: 'WEAPON',
      order: 3
    },
    // Saving throws: STR, CON
    {
      id: classRowId(F, 2, 5),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SAVE_ABILITY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      abilities: [ABILITY_CODE.STRENGTH, ABILITY_CODE.CONSTITUTION],
      order: 4
    },
    // Skills: choose 2 from Acrobatics, Animal Handling, Athletics, History, Insight, Intimidation, Perception, Survival
    {
      id: classRowId(F, 2, 6),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SKILL,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
      scalingKind: SCALING.NONE,
      count: 2,
      selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      skillIds: [
        skillId('ACROBATICS'),
        skillId('ANIMAL_HANDLING'),
        skillId('ATHLETICS'),
        skillId('HISTORY'),
        skillId('INSIGHT'),
        skillId('INTIMIDATION'),
        skillId('PERCEPTION'),
        skillId('SURVIVAL')
      ],
      order: 5
    }
  ],
  features: [
    {
      id: classRowId(F, 3, 1),
      label: 'Fighting Style',
      description:
        "You adopt a particular style of fighting as your specialty. Choose one of the following options. You can't take a Fighting Style option more than once, even if you later get to choose again.",
      availableAtLevel: 1,
      order: 0,
      optionChoices: [{ level: 1, count: 1 }],
      options: [
        {
          id: classRowId(F, 4, 1),
          label: 'Archery',
          description: 'You gain a +2 bonus to attack rolls you make with ranged weapons.',
          grants: {
            modifiers: [
              {
                id: classRowId(F, 4, 10),
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
                  (entry) => classRowId(F, 0x7a, 0x10 + entry),
                  [{ constraint: 'INCLUDE', properties: ['RANGED'] }]
                )
              }
            ]
          },
          order: 0
        },
        {
          id: classRowId(F, 4, 2),
          label: 'Defense',
          description: 'While you are wearing armor, you gain a +1 bonus to AC.',
          grants: {
            modifiers: [
              {
                id: classRowId(F, 4, 11),
                grantKind: GRANT_KIND.MODIFIER_GRANT,
                valueDomainCode: VALUE_DOMAIN_CODE.ARMOR_CLASS,
                domain: {},
                modifierKind: MODIFIER_KIND.BONUS,
                scope: MODIFIER_SCOPE_KIND.GLOBAL,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                payload: { valueKind: 'FIXED' as const, amount: 1 },
                order: 0,
                restrictions: equippedCategoryRestriction(
                  (entry) => classRowId(F, 0x7a, 0x18 + entry),
                  'INCLUDE',
                  [EQUIPMENT_CATEGORY_CODE.ARMOR]
                )
              }
            ]
          },
          order: 1
        },
        {
          id: classRowId(F, 4, 3),
          label: 'Dueling',
          description:
            'When you are wielding a melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.',
          grants: {
            modifiers: [
              {
                id: classRowId(F, 4, 12),
                grantKind: GRANT_KIND.MODIFIER_GRANT,
                valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
                domain: { attackDomain: 'MELEE' as const },
                modifierKind: MODIFIER_KIND.BONUS,
                scope: MODIFIER_SCOPE_KIND.GLOBAL,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                payload: { valueKind: 'FIXED' as const, amount: 2 },
                order: 0,
                restrictions: duelingRestriction((entry) => classRowId(F, 0x7a, 0x20 + entry))
              }
            ]
          },
          order: 2
        },
        {
          id: classRowId(F, 4, 4),
          label: 'Great Weapon Fighting',
          description:
            'When you roll a 1 or 2 on a damage die for an attack you make with a melee weapon that you are wielding with two hands, you can reroll the die and must use the new roll, even if the new roll is a 1 or a 2. The weapon must have the two-handed or versatile property for you to gain this benefit.',
          order: 3,
          effects: [
            closedRuleEffect({
              id: classRowId(F, 0x60, 0x84),
              ruleKind: CLOSED_RULE_KIND.CLASS_FIGHTER_FIGHTING_STYLE_GREAT_WEAPON_FIGHTING,
              pathCode: PATH_CODE.ON_HIT,
              invocation: {
                kind: 'PASSIVE',
                triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
                range: { id: classRowId(F, 0x69, 0x84), rangeKind: RANGE_KIND.SPECIAL },
                targeting: {
                  selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                  dispositionKind: 'HOSTILE'
                }
              }
            })
          ]
        },
        {
          id: classRowId(F, 4, 5),
          label: 'Protection',
          description:
            'When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll. You must be wielding a shield.',
          order: 4,
          effects: [
            closedRuleEffect({
              id: classRowId(F, 0x60, 0x85),
              ruleKind: CLOSED_RULE_KIND.CLASS_FIGHTER_FIGHTING_STYLE_PROTECTION,
              invocation: {
                kind: 'ACTION',
                triggerCode: TRIGGER.ACTIVATED,
                activation: { code: ACTIVATION_CODE.REACTION, amount: 1 },
                range: {
                  id: classRowId(F, 0x69, 0x85),
                  rangeKind: RANGE_KIND.DISTANCE,
                  amount: 5,
                  unit: MEASUREMENT_UNIT_CODE.FEET
                },
                targeting: {
                  selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                  dispositionKind: 'ANY',
                  self: 'WARN'
                }
              }
            })
          ]
        },
        {
          id: classRowId(F, 4, 6),
          label: 'Two-Weapon Fighting',
          description:
            'When you engage in two-weapon fighting, you can add your ability modifier to the damage of the second attack.',
          grants: {
            modifiers: twoWeaponFightingGrants(
              (entry) => classRowId(F, 4, 13 + entry),
              (entry) => classRowId(F, 0x7a, 0x40 + entry)
            )
          },
          order: 5
        }
      ]
    },
    {
      id: classRowId(F, 3, 2),
      label: 'Second Wind',
      description:
        'You have a limited well of stamina that you can draw on to protect yourself from harm. On your turn, you can use a bonus action to regain hit points equal to 1d10 + your fighter level. Once you use this feature, you must finish a short or long rest before you can use it again.',
      attributes: ['LIMITED_USE'],
      charges: {
        id: classRowId(F, 3, 20),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: SCALING.NONE,
        resetKind: 'SHORT_REST',
        amount: 1
      },
      effects: [
        {
          id: classRowId(F, 3, 21),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: TRIGGER.ACTIVATED,
            resourceUse: { chargeId: classRowId(F, 3, 20), cost: 1 },
            activation: {
              code: ACTIVATION_CODE.BONUS_ACTION,
              amount: 1
            },
            range: {
              id: classRowId(F, 3, 22),
              rangeKind: RANGE_KIND.SELF
            },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SELF
            }
          },
          paths: [
            {
              id: classRowId(F, 3, 23),
              order: 1,
              pathCode: PATH_CODE.ON_USE,
              groupType: PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: classRowId(F, 3, 23) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: classRowId(F, 0x6d, 1),
                    effectKind: EFFECT_KIND.HEAL,
                    valueKind: 'DICE',
                    scalingKind: SCALING.NONE,
                    diceConfig: '1d10',
                    bonuses: [
                      {
                        id: classRowId(F, 3, 24),
                        bonusKind: 'CLASS_LEVEL',
                        classId: CLASS_IDS.FIGHTER,
                        order: 1
                      }
                    ]
                  }
                ]
              }
            }
          ]
        }
      ],
      availableAtLevel: 1,
      order: 1
    },
    {
      id: classRowId(F, 3, 3),
      label: 'Action Surge',
      attributes: [FEATURE_ATTRIBUTE.LIMITED_USE],
      description:
        'Starting at 2nd level, you can push yourself beyond your normal limits for a moment. On your turn, you can take one additional action on top of your regular action and a possible bonus action. Once you use this feature, you must finish a short or long rest before you can use it again. Starting at 17th level, you can use it twice before a rest, but only once on the same turn.',
      availableAtLevel: 2,
      order: 2,
      charges: {
        id: classRowId(F, 0x66, 3),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: SCALING.PER_LEVEL,
        resetKind: 'SHORT_REST',
        levels: [
          { id: classRowId(F, 0x67, 1), level: 2, amount: 1 },
          { id: classRowId(F, 0x67, 2), level: 17, amount: 2 }
        ]
      },
      // One additional Action this turn: the grant sets the Action count to 2, so a second Surge on
      // the same turn adds no third Action.
      effects: [
        {
          id: classRowId(F, 0x60, 3),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: TRIGGER.ACTIVATED,
            resourceUse: { chargeId: classRowId(F, 0x66, 3), cost: 1 },
            activation: { code: ACTIVATION_CODE.FREE },
            range: { id: classRowId(F, 0x69, 3), rangeKind: RANGE_KIND.SELF },
            targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
          },
          paths: [
            {
              id: classRowId(F, 0x80, 3),
              order: 1,
              pathCode: PATH_CODE.ON_USE,
              groupType: PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: classRowId(F, 0x81, 3),
                resultKind: 'SINGLE',
                duration: { id: classRowId(F, 0x83, 3), durationKind: 'TURN', amount: 1 },
                lifecycle: { turnAnchor: { actor: 'TARGET', boundary: 'END_OF_TURN' } },
                outcomes: [
                  {
                    id: classRowId(F, 0x82, 3),
                    effectKind: EFFECT_KIND.APPLY_GRANT,
                    grants: {
                      modifiers: [
                        {
                          id: classRowId(F, 0x84, 3),
                          grantKind: GRANT_KIND.MODIFIER_GRANT,
                          valueDomainCode: VALUE_DOMAIN_CODE.ACTION_COUNT,
                          domain: {},
                          modifierKind: MODIFIER_KIND.SET_VALUE,
                          scope: MODIFIER_SCOPE_KIND.GLOBAL,
                          selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                          payload: { amount: 2 },
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
      id: classRowId(F, 3, 4),
      label: 'Martial Archetype',
      description:
        'At 3rd level, you choose an archetype that you strive to emulate in your combat styles and techniques, such as Champion. The archetype you choose grants you features at 3rd level and again at 7th, 10th, 15th, and 18th level.',
      attributes: [FEATURE_ATTRIBUTE.SUBCLASS_SELECTION],
      availableAtLevel: 3,
      order: 3
    },
    {
      id: classRowId(F, 3, 5),
      label: 'Ability Score Improvement',
      description: abilityScoreImprovementDescription,
      availableAtLevel: 4,
      order: 4,
      optionChoices: [{ level: 4, count: 1 }],
      options: abilityScoreImprovementOptions(
        (optionEntry) => classRowId(F, 5, optionEntry),
        abilityScoreImprovementDescription
      ),
      effects: [selfClassRuleEffect(5, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)]
    },
    {
      id: classRowId(F, 3, 6),
      label: 'Extra Attack',
      description:
        'Beginning at 5th level, you can attack twice, instead of once, whenever you take the Attack action on your turn. The number of attacks increases to three when you reach 11th level in this class and to four when you reach 20th level in this class.',
      availableAtLevel: 5,
      order: 5,
      grants: {
        modifiers: [attacksPerAttackActionGrant(classRowId(F, 0x6f, 1), 2)]
      }
    },
    {
      id: classRowId(F, 3, 7),
      label: 'Ability Score Improvement',
      description: abilityScoreImprovementDescription,
      availableAtLevel: 6,
      order: 6,
      optionChoices: [{ level: 6, count: 1 }],
      options: abilityScoreImprovementOptions(
        (optionEntry) => classRowId(F, 7, optionEntry),
        abilityScoreImprovementDescription
      ),
      effects: [selfClassRuleEffect(7, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)]
    },
    {
      id: classRowId(F, 3, 8),
      label: 'Martial Archetype Feature',
      description:
        'At 3rd level, you choose an archetype that you strive to emulate in your combat styles and techniques, such as Champion. The archetype you choose grants you features at 3rd level and again at 7th, 10th, 15th, and 18th level.',
      availableAtLevel: 7,
      order: 7
    },
    {
      id: classRowId(F, 3, 9),
      label: 'Ability Score Improvement',
      description: abilityScoreImprovementDescription,
      availableAtLevel: 8,
      order: 8,
      optionChoices: [{ level: 8, count: 1 }],
      options: abilityScoreImprovementOptions(
        (optionEntry) => classRowId(F, 9, optionEntry),
        abilityScoreImprovementDescription
      ),
      effects: [selfClassRuleEffect(9, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)]
    },
    {
      id: classRowId(F, 3, 10),
      label: 'Indomitable',
      attributes: [FEATURE_ATTRIBUTE.LIMITED_USE],
      description:
        "Beginning at 9th level, you can reroll a saving throw that you fail. If you do so, you must use the new roll, and you can't use this feature again until you finish a long rest. You can use this feature twice between long rests starting at 13th level and three times between long rests starting at 17th level.",
      availableAtLevel: 9,
      order: 9,
      charges: {
        id: classRowId(F, 0x66, 10),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: SCALING.PER_LEVEL,
        resetKind: 'LONG_REST',
        levels: [
          { id: classRowId(F, 0x68, 1), level: 9, amount: 1 },
          { id: classRowId(F, 0x68, 2), level: 13, amount: 2 },
          { id: classRowId(F, 0x68, 3), level: 17, amount: 3 }
        ]
      },
      // The charge spend is automated; the reroll waits on a save-result window (future-enhancements).
      effects: [
        gmRulingEffect({
          ids: {
            effect: classRowId(F, 0x60, 10),
            range: classRowId(F, 0x69, 10),
            path: classRowId(F, 0x80, 10),
            result: classRowId(F, 0x81, 10),
            outcome: classRowId(F, 0x6c, 10)
          },
          label: 'Indomitable',
          reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
          instructions:
            'Use this right after you fail a saving throw: reroll that saving throw and use the new roll, even if it is lower. The GM applies the new result in place of the failed one.',
          resourceUse: { chargeId: classRowId(F, 0x66, 10), cost: 1 }
        })
      ]
    },
    {
      id: classRowId(F, 3, 11),
      label: 'Martial Archetype Feature',
      description:
        'At 3rd level, you choose an archetype that you strive to emulate in your combat styles and techniques, such as Champion. The archetype you choose grants you features at 3rd level and again at 7th, 10th, 15th, and 18th level.',
      availableAtLevel: 10,
      order: 10
    },
    {
      id: classRowId(F, 3, 18),
      label: 'Extra Attack (2)',
      description:
        'You can attack three times, instead of once, whenever you take the Attack action on your turn.',
      availableAtLevel: 11,
      order: 11,
      grants: {
        modifiers: [attacksPerAttackActionGrant(classRowId(F, 0x6f, 2), 3)]
      }
    },
    {
      id: classRowId(F, 3, 12),
      label: 'Ability Score Improvement',
      description: abilityScoreImprovementDescription,
      availableAtLevel: 12,
      order: 12,
      optionChoices: [{ level: 12, count: 1 }],
      options: abilityScoreImprovementOptions(
        (optionEntry) => classRowId(F, 12, optionEntry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(12, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(F, 3, 13),
      label: 'Ability Score Improvement',
      description: abilityScoreImprovementDescription,
      availableAtLevel: 14,
      order: 13,
      optionChoices: [{ level: 14, count: 1 }],
      options: abilityScoreImprovementOptions(
        (optionEntry) => classRowId(F, 13, optionEntry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(13, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(F, 3, 14),
      label: 'Martial Archetype Feature',
      description:
        'At 3rd level, you choose an archetype that you strive to emulate in your combat styles and techniques, such as Champion. The archetype you choose grants you features at 3rd level and again at 7th, 10th, 15th, and 18th level.',
      availableAtLevel: 15,
      order: 14
    },
    {
      id: classRowId(F, 3, 15),
      label: 'Ability Score Improvement',
      description: abilityScoreImprovementDescription,
      availableAtLevel: 16,
      order: 15,
      optionChoices: [{ level: 16, count: 1 }],
      options: abilityScoreImprovementOptions(
        (optionEntry) => classRowId(F, 15, optionEntry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(15, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(F, 3, 16),
      label: 'Ability Score Improvement',
      description: abilityScoreImprovementDescription,
      availableAtLevel: 19,
      order: 16,
      optionChoices: [{ level: 19, count: 1 }],
      options: abilityScoreImprovementOptions(
        (optionEntry) => classRowId(F, 16, optionEntry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(16, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(F, 3, 17),
      label: 'Martial Archetype Feature',
      description:
        'At 3rd level, you choose an archetype that you strive to emulate in your combat styles and techniques, such as Champion. The archetype you choose grants you features at 3rd level and again at 7th, 10th, 15th, and 18th level.',
      availableAtLevel: 18,
      order: 17
    },
    {
      id: classRowId(F, 3, 19),
      label: 'Extra Attack (3)',
      description:
        'You can attack four times, instead of once, whenever you take the Attack action on your turn.',
      availableAtLevel: 20,
      order: 18,
      grants: {
        modifiers: [attacksPerAttackActionGrant(classRowId(F, 0x6f, 3), 4)]
      }
    }
  ]
}
