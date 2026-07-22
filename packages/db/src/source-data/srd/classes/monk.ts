import {
  ABILITY_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_DUPLICATE_POLICY,
  AUTHORING_SELECTION_KIND,
  CLASS_ATTRIBUTE,
  CLASS_CATEGORY,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  FEATURE_ATTRIBUTE,
  GRANT_KIND,
  PROFICIENCY_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  STARTING_EQUIPMENT_KIND,
  type ClassAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS } from '../ids.js'
import { SRD_CURRENCIES, SRD_SKILLS, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'

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

const M = 6 // Monk class index

// Ki resource charge — resets on short or long rest
const kiCharge = {
  id: classRowId(M, 1, 1),
  limitKind: 'CLASS_LEVEL' as const,
  scalingKind: SCALING.NONE,
  classId: CLASS_IDS.MONK,
  resetKind: 'SHORT_REST' as const
}

export const monk: ClassAuthored = {
  id: CLASS_IDS.MONK,
  label: 'Monk',
  category: CLASS_CATEGORY.BASE,
  subclassSelectionLevel: 3,
  attributes: [CLASS_ATTRIBUTE.RESOURCE],
  description:
    'A master of martial arts, harnessing the power of the body in pursuit of physical and spiritual perfection.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,

  hitpoint: {
    ability: ABILITY_CODE.CONSTITUTION,
    dieConfig: 'd8'
  },

  startingGold: {
    multiplier: 10,
    currencyId: goldCurrencyId,
    dieConfig: '5d4'
  },

  multiclass: {
    id: classRowId(M, 99, 1),
    requirementGroups: {
      groups: [
        {
          id: classRowId(M, 99, 2),
          requirements: [
            { id: classRowId(M, 99, 3), ability: ABILITY_CODE.DEXTERITY, min: 13 },
            { id: classRowId(M, 99, 4), ability: ABILITY_CODE.WISDOM, min: 13 }
          ]
        }
      ]
    }
  },

  startingEquipment: {
    id: classRowId(M, 98, 1),
    sets: [
      {
        id: classRowId(M, 98, 2),
        order: 0,
        groups: [
          {
            id: classRowId(M, 98, 3),
            order: 0,
            options: [
              {
                id: classRowId(M, 98, 4),
                order: 0,
                items: [
                  {
                    id: classRowId(M, 98, 5),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(28)],
                    quantity: 1
                  }
                ]
              },
              {
                id: classRowId(M, 98, 6),
                order: 1,
                items: [
                  {
                    id: classRowId(M, 98, 7),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
                    authoringModeKind: AUTHORING_MODE_KIND.ALL,
                    category: EQUIPMENT_CATEGORY_CODE.WEAPON,
                    properties: [EQUIPMENT_PROPERTY_CODE.SIMPLE],
                    count: 1
                  }
                ]
              }
            ]
          },
          {
            id: classRowId(M, 98, 8),
            order: 1,
            options: [
              {
                id: classRowId(M, 98, 9),
                order: 0,
                items: [
                  {
                    id: classRowId(M, 98, 10),
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
                id: classRowId(M, 98, 11),
                order: 1,
                items: [
                  {
                    id: classRowId(M, 98, 12),
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
          },
          {
            id: classRowId(M, 98, 13),
            order: 2,
            options: [
              {
                id: classRowId(M, 98, 14),
                order: 0,
                items: [
                  {
                    id: classRowId(M, 98, 15),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(12)],
                    quantity: 10
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
    // Simple weapons
    {
      id: classRowId(M, 2, 1),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      properties: ['SIMPLE'],
      category: 'WEAPON',
      order: 0
    },
    // Saving throws: STR, DEX
    {
      id: classRowId(M, 2, 2),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SAVE_ABILITY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      abilities: [ABILITY_CODE.STRENGTH, ABILITY_CODE.DEXTERITY],
      order: 1
    },
    // Skills: choose 2 from Acrobatics, Athletics, History, Insight, Religion, Stealth
    {
      id: classRowId(M, 2, 3),
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
        skillId('ATHLETICS'),
        skillId('HISTORY'),
        skillId('INSIGHT'),
        skillId('RELIGION'),
        skillId('STEALTH')
      ],
      order: 2
    }
  ],

  resources: {
    order: 0,
    id: classRowId(M, 5, 1),
    label: 'Ki',
    availableAtLevel: 2,
    charges: kiCharge
  },

  features: [
    {
      id: classRowId(M, 3, 1),
      label: 'Unarmored Defense',
      description:
        'Beginning at 1st level, while you are wearing no armor and not wielding a shield, your AC equals 10 + your Dexterity modifier + your Wisdom modifier.',
      availableAtLevel: 1,
      order: 0
    },
    {
      id: classRowId(M, 3, 2),
      label: 'Martial Arts',
      description:
        'At 1st level, your practice of martial arts gives you mastery of combat styles that use unarmed strikes and monk weapons.',
      availableAtLevel: 1,
      order: 1
    },
    {
      id: classRowId(M, 3, 3),
      label: 'Ki',
      description:
        'Starting at 2nd level, your training allows you to harness the mystic energy of ki. Your access to this energy is represented by a number of ki points equal to your monk level.',
      availableAtLevel: 2,
      order: 2
    },
    {
      id: classRowId(M, 3, 4),
      label: 'Unarmored Movement',
      description:
        'Starting at 2nd level, your speed increases by 10 feet while you are not wearing armor or wielding a shield. This bonus increases as you gain monk levels.',
      availableAtLevel: 2,
      order: 3
    },
    {
      id: classRowId(M, 3, 5),
      label: 'Monastic Tradition',
      description: 'When you reach 3rd level, you commit yourself to a monastic tradition.',
      attributes: [FEATURE_ATTRIBUTE.SUBCLASS_SELECTION],
      availableAtLevel: 3,
      order: 4
    },
    {
      id: classRowId(M, 3, 6),
      label: 'Deflect Missiles',
      description:
        'Starting at 3rd level, you can use your reaction to deflect or catch the missile when you are hit by a ranged weapon attack.',
      availableAtLevel: 3,
      order: 5
    },
    {
      id: classRowId(M, 3, 7),
      label: 'Ability Score Improvement',
      description:
        'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 4,
      order: 6
    },
    {
      id: classRowId(M, 3, 8),
      label: 'Slow Fall',
      description:
        'Beginning at 4th level, you can use your reaction when you fall to reduce any falling damage you take by an amount equal to five times your monk level.',
      availableAtLevel: 4,
      order: 7
    },
    {
      id: classRowId(M, 3, 9),
      label: 'Extra Attack',
      description:
        'Beginning at 5th level, you can attack twice, instead of once, whenever you take the Attack action on your turn.',
      availableAtLevel: 5,
      order: 8
    },
    {
      id: classRowId(M, 3, 10),
      label: 'Stunning Strike',
      description:
        "Starting at 5th level, you can interfere with the flow of ki in an opponent's body. When you hit another creature with a melee weapon attack, you can spend 1 ki point to attempt a stunning strike.",
      availableAtLevel: 5,
      order: 9
    },
    {
      id: classRowId(M, 3, 11),
      label: 'Ki-Empowered Strikes',
      description:
        'Starting at 6th level, your unarmed strikes count as magical for the purpose of overcoming resistance and immunity to nonmagical attacks and damage.',
      availableAtLevel: 6,
      order: 10
    },
    {
      id: classRowId(M, 3, 12),
      label: 'Monastic Tradition Feature',
      description: 'At 6th level, you gain a feature from your Monastic Tradition.',
      availableAtLevel: 6,
      order: 11
    },
    {
      id: classRowId(M, 3, 13),
      label: 'Evasion',
      description:
        'At 7th level, your instinctive agility lets you dodge out of the way of certain area effects.',
      availableAtLevel: 7,
      order: 12
    },
    {
      id: classRowId(M, 3, 14),
      label: 'Stillness of Mind',
      description:
        'Starting at 7th level, you can use your action to end one effect on yourself that is causing you to be charmed or frightened.',
      availableAtLevel: 7,
      order: 13
    },
    {
      id: classRowId(M, 3, 15),
      label: 'Ability Score Improvement',
      description:
        'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 8,
      order: 14
    },
    {
      id: classRowId(M, 3, 16),
      label: 'Unarmored Movement Improvement',
      description:
        'At 9th level, you gain the ability to move along vertical surfaces and across liquids on your turn without falling during the move.',
      availableAtLevel: 9,
      order: 15
    },
    {
      id: classRowId(M, 3, 17),
      label: 'Purity of Body',
      description:
        'At 10th level, your mastery of the ki flowing through you makes you immune to disease and poison.',
      availableAtLevel: 10,
      order: 16
    },
    {
      id: classRowId(M, 3, 18),
      label: 'Monastic Tradition Feature',
      description: 'At 11th level, you gain a feature from your Monastic Tradition.',
      availableAtLevel: 11,
      order: 17
    },
    {
      id: classRowId(M, 3, 19),
      label: 'Ability Score Improvement',
      description:
        'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 12,
      order: 18
    },
    {
      id: classRowId(M, 3, 20),
      label: 'Tongue of the Sun and Moon',
      description:
        'Starting at 13th level, you learn to touch the ki of other minds so that you understand all spoken languages. Moreover, any creature that can understand a language can understand what you say.',
      availableAtLevel: 13,
      order: 19
    },
    {
      id: classRowId(M, 3, 21),
      label: 'Diamond Soul',
      description:
        'Beginning at 14th level, your mastery of ki grants you proficiency in all saving throws. Additionally, whenever you make a saving throw and fail, you can spend 1 ki point to reroll it and take the second result.',
      availableAtLevel: 14,
      order: 20,
      grants: {
        proficiencies: [
          {
            id: classRowId(M, 3, 210),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.SAVE_ABILITY,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            abilities: [
              ABILITY_CODE.STRENGTH,
              ABILITY_CODE.DEXTERITY,
              ABILITY_CODE.CONSTITUTION,
              ABILITY_CODE.INTELLIGENCE,
              ABILITY_CODE.WISDOM,
              ABILITY_CODE.CHARISMA
            ],
            order: 0
          }
        ]
      }
    },
    {
      id: classRowId(M, 3, 22),
      label: 'Timeless Body',
      description:
        "At 15th level, your ki sustains you so that you suffer none of the frailty of old age, and you can't be aged magically. You can still die of old age, however.",
      availableAtLevel: 15,
      order: 21
    },
    {
      id: classRowId(M, 3, 23),
      label: 'Ability Score Improvement',
      description:
        'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 16,
      order: 22
    },
    {
      id: classRowId(M, 3, 24),
      label: 'Monastic Tradition Feature',
      description: 'At 17th level, you gain a feature from your Monastic Tradition.',
      availableAtLevel: 17,
      order: 23
    },
    {
      id: classRowId(M, 3, 25),
      label: 'Empty Body',
      description:
        'Beginning at 18th level, you can use your action to spend 4 ki points to become invisible for 1 minute. During that time, you also have resistance to all damage but force damage.',
      availableAtLevel: 18,
      order: 24
    },
    {
      id: classRowId(M, 3, 26),
      label: 'Ability Score Improvement',
      description:
        'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 19,
      order: 25
    },
    {
      id: classRowId(M, 3, 27),
      label: 'Perfect Self',
      description:
        'At 20th level, when you roll for initiative and have no ki points remaining, you regain 4 ki points.',
      availableAtLevel: 20,
      order: 26
    }
  ]
}
