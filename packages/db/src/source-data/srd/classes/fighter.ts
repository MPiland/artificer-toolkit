import { ACTIVATION_CODE, ABILITY_CODE, AUTHORING_MODE_KIND, AUTHORING_SELECTION_KIND, PATH_CODE, PATH_GROUP_TYPE, CLASS_CATEGORY, EFFECT_KIND, GRANT_KIND, MODIFIER_KIND, MODIFIER_SCOPE_KIND, PROFICIENCY_KIND, RANGE_KIND, SCALING, SCALING_AMOUNT_KIND, TARGET_SELECTION_KIND, TRIGGER, VALUE_DOMAIN_CODE, type ClassAuthored } from '@artificer-toolkit/shared'
import { CLASS_IDS } from '../ids.js'
import { SRD_CURRENCIES, SRD_SKILLS, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'
function skillId(code: string): string {
  const entry = SRD_SKILLS.find((s) => s.code === code)
  if (!entry)
    throw new Error(`SRD skill vocabulary entry for ${code} required.`)
  return entry.id
}
const goldCurrencyId = SRD_CURRENCIES.find((c) => c.code === 'GP')?.id
if (!goldCurrencyId)
  throw new Error('SRD GP currency required.')
function classRowId(classIndex: number, group: number, entry: number): string {
  const xx = classIndex.toString(16).padStart(2, '0')
  const gg = group.toString(16).padStart(2, '0')
  const nn = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-c0${xx}-${gg}${nn}00000000`
}
const F = 5 // Fighter class index
// Second Wind charge - resets on short or long rest
const secondWindCharge = {
  id: classRowId(F, 1, 1),
  limitKind: 'FIXED_AMOUNT' as const,
  scalingKind: SCALING.NONE,
  resetKind: 'SHORT_REST' as const,
  amount: 1
}
export const fighter: ClassAuthored = {
  id: CLASS_IDS.FIGHTER,
  label: 'Fighter',
  category: CLASS_CATEGORY.BASE,
  description: 'A master of martial combat, skilled with a variety of weapons and armor.',
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
    sets: []
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
  resources: {
    id: classRowId(F, 5, 1),
    label: 'Second Wind',
    availableAtLevel: 1,
    charges: secondWindCharge
  },
  features: [
    {
      id: classRowId(F, 3, 1),
      label: 'Fighting Style',
      description: 'You adopt a particular style of fighting as your specialty. Choose one of the following options: Archery, Defense, Dueling, Great Weapon Fighting, Protection, Two-Weapon Fighting.',
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
                scope: MODIFIER_SCOPE_KIND.SOURCE,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                payload: { valueKind: 'FIXED' as const, amount: 2 },
                order: 0
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
                scope: MODIFIER_SCOPE_KIND.SOURCE,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                payload: { valueKind: 'FIXED' as const, amount: 1 },
                order: 0
              }
            ]
          },
          order: 1
        },
        {
          id: classRowId(F, 4, 3),
          label: 'Dueling',
          description: 'When you are wielding a melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.',
          grants: {
            modifiers: [
              {
                id: classRowId(F, 4, 12),
                grantKind: GRANT_KIND.MODIFIER_GRANT,
                valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
                domain: { attackDomain: 'MELEE' as const },
                modifierKind: MODIFIER_KIND.BONUS,
                scope: MODIFIER_SCOPE_KIND.SOURCE,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                payload: { valueKind: 'FIXED' as const, amount: 2 },
                order: 0
              }
            ]
          },
          order: 2
        },
        {
          id: classRowId(F, 4, 4),
          label: 'Great Weapon Fighting',
          description: 'When you roll a 1 or 2 on a damage die for an attack you make with a melee weapon that you are wielding with two hands, you can reroll the die and must use the new roll.',
          order: 3
        },
        {
          id: classRowId(F, 4, 5),
          label: 'Protection',
          description: 'When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll. You must be wielding a shield.',
          order: 4
        },
        {
          id: classRowId(F, 4, 6),
          label: 'Two-Weapon Fighting',
          description: 'When you engage in two-weapon fighting, you can add your ability modifier to the damage of the second attack.',
          order: 5
        }
      ]
    },
    {
      id: classRowId(F, 3, 2),
      label: 'Second Wind',
      description: 'You have a limited well of stamina that you can draw on to protect yourself from harm. On your turn, you can use a bonus action to regain hit points equal to 1d10 + your fighter level. Once you use this feature, you must finish a short or long rest before you can use it again.',
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
                    id: classRowId(F, 3, 23),
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
      description: 'Starting at 2nd level, you can push yourself beyond your normal limits for a moment. On your turn, you can take one additional action. Once you use this feature, you must finish a short or long rest before you can use it again. Starting at 17th level, you can use it twice before a rest.',
      availableAtLevel: 2,
      order: 2
    },
    {
      id: classRowId(F, 3, 4),
      label: 'Martial Archetype',
      description: 'At 3rd level, you choose an archetype that you strive to emulate in your combat styles and techniques.',
      availableAtLevel: 3,
      order: 3
    },
    {
      id: classRowId(F, 3, 5),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 4,
      order: 4
    },
    {
      id: classRowId(F, 3, 6),
      label: 'Extra Attack',
      description: 'Beginning at 5th level, you can attack twice, instead of once, whenever you take the Attack action on your turn. The number of attacks increases to three when you reach 11th level and to four when you reach 20th level.',
      availableAtLevel: 5,
      order: 5
    },
    {
      id: classRowId(F, 3, 7),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 6,
      order: 6
    },
    {
      id: classRowId(F, 3, 8),
      label: 'Martial Archetype Feature',
      description: 'At 7th level, you gain a feature from your Martial Archetype.',
      availableAtLevel: 7,
      order: 7
    },
    {
      id: classRowId(F, 3, 9),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 8,
      order: 8
    },
    {
      id: classRowId(F, 3, 10),
      label: 'Indomitable',
      description: 'Beginning at 9th level, you can reroll a saving throw that you fail. If you do so, you must use the new roll. You can use this feature twice between long rests starting at 13th level and three times between long rests starting at 17th level.',
      availableAtLevel: 9,
      order: 9
    },
    {
      id: classRowId(F, 3, 11),
      label: 'Martial Archetype Feature',
      description: 'At 10th level, you gain a feature from your Martial Archetype.',
      availableAtLevel: 10,
      order: 10
    },
    {
      id: classRowId(F, 3, 12),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 12,
      order: 11
    },
    {
      id: classRowId(F, 3, 13),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 14,
      order: 12
    },
    {
      id: classRowId(F, 3, 14),
      label: 'Martial Archetype Feature',
      description: 'At 15th level, you gain a feature from your Martial Archetype.',
      availableAtLevel: 15,
      order: 13
    },
    {
      id: classRowId(F, 3, 15),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 16,
      order: 14
    },
    {
      id: classRowId(F, 3, 16),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 19,
      order: 15
    },
    {
      id: classRowId(F, 3, 17),
      label: 'Martial Archetype Feature',
      description: 'At 18th level, you gain a feature from your Martial Archetype.',
      availableAtLevel: 18,
      order: 16
    }
  ]
}
