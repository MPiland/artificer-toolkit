import {
  ACTIVATION_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_DUPLICATE_POLICY,
  AUTHORING_SELECTION_KIND,
  CLASS_ATTRIBUTE,
  CLASS_CATEGORY,
  CLOSED_RULE_KIND,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  FEATURE_ATTRIBUTE,
  GRANT_KIND,
  PROFICIENCY_KIND,
  RANGE_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  SPELLCASTING_ATTRIBUTE,
  STARTING_EQUIPMENT_KIND,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type ActivationCode,
  type ClassAuthored,
  type ClosedRuleKind,
  type EffectAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS } from '../ids.js'
import {
  SRD_CURRENCIES,
  SRD_SKILLS,
  SRD_SYSTEM_ID,
  SRD_USER_ID,
  ABILITY_CODE
} from '../vocabulary.js'
import { classSpellcastingDetails } from './spellcasting-details.js'
import { abilityScoreImprovementOptions, closedRuleEffect } from './mechanics.js'

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

const S = 10 // Sorcerer class index

const abilityScoreImprovementDescription =
  "When you reach 4th level, and again at 8th, 12th, 16th, and 19th level, you can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1. As normal, you can't increase an ability score above 20 using this feature."

function selfClassRuleEffect(
  entry: number,
  ruleKind: ClosedRuleKind,
  activationCode?: Exclude<ActivationCode, 'FREE'>
): EffectAuthored {
  const range = { id: classRowId(S, 0x69, entry), rangeKind: RANGE_KIND.SELF } as const
  return closedRuleEffect({
    id: classRowId(S, 0x60, entry),
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

// Sorcerer spell slot charge — full caster, resets on long rest
const sorcererSlotCharge = {
  id: classRowId(S, 1, 1),
  limitKind: 'FIXED_AMOUNT' as const,
  scalingKind: SCALING.PER_LEVEL,
  resetKind: 'LONG_REST' as const,
  levels: [
    { id: classRowId(S, 1, 2), level: 1, amount: 2 },
    { id: classRowId(S, 1, 3), level: 2, amount: 3 },
    { id: classRowId(S, 1, 4), level: 3, amount: 4 },
    { id: classRowId(S, 1, 5), level: 4, amount: 4 },
    { id: classRowId(S, 1, 6), level: 5, amount: 4 },
    { id: classRowId(S, 1, 7), level: 6, amount: 4 },
    { id: classRowId(S, 1, 8), level: 7, amount: 4 },
    { id: classRowId(S, 1, 9), level: 8, amount: 4 },
    { id: classRowId(S, 1, 10), level: 9, amount: 4 },
    { id: classRowId(S, 1, 11), level: 10, amount: 5 },
    { id: classRowId(S, 1, 12), level: 11, amount: 5 },
    { id: classRowId(S, 1, 13), level: 12, amount: 5 },
    { id: classRowId(S, 1, 14), level: 13, amount: 5 },
    { id: classRowId(S, 1, 15), level: 14, amount: 5 },
    { id: classRowId(S, 1, 16), level: 15, amount: 5 },
    { id: classRowId(S, 1, 17), level: 16, amount: 5 },
    { id: classRowId(S, 1, 18), level: 17, amount: 5 },
    { id: classRowId(S, 1, 19), level: 18, amount: 5 },
    { id: classRowId(S, 1, 20), level: 19, amount: 5 },
    { id: classRowId(S, 1, 21), level: 20, amount: 5 }
  ]
}

const sorcererSpellLimits = [
  {
    classLevel: 1,
    slots: [{ spellLevel: 1, slotCount: 2 }],
    learnedSpellsLimit: 2,
    cantripsLimit: 4
  },
  {
    classLevel: 2,
    slots: [{ spellLevel: 1, slotCount: 3 }],
    learnedSpellsLimit: 3,
    cantripsLimit: 4
  },
  {
    classLevel: 3,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 2 }
    ],
    learnedSpellsLimit: 4,
    cantripsLimit: 4
  },
  {
    classLevel: 4,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 }
    ],
    learnedSpellsLimit: 5,
    cantripsLimit: 5
  },
  {
    classLevel: 5,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 2 }
    ],
    learnedSpellsLimit: 6,
    cantripsLimit: 5
  },
  {
    classLevel: 6,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 }
    ],
    learnedSpellsLimit: 7,
    cantripsLimit: 5
  },
  {
    classLevel: 7,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 1 }
    ],
    learnedSpellsLimit: 8,
    cantripsLimit: 5
  },
  {
    classLevel: 8,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 2 }
    ],
    learnedSpellsLimit: 9,
    cantripsLimit: 5
  },
  {
    classLevel: 9,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 1 }
    ],
    learnedSpellsLimit: 10,
    cantripsLimit: 5
  },
  {
    classLevel: 10,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 2 }
    ],
    learnedSpellsLimit: 11,
    cantripsLimit: 6
  },
  {
    classLevel: 11,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 2 },
      { spellLevel: 6, slotCount: 1 }
    ],
    learnedSpellsLimit: 12,
    cantripsLimit: 6
  },
  {
    classLevel: 12,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 2 },
      { spellLevel: 6, slotCount: 1 }
    ],
    learnedSpellsLimit: 12,
    cantripsLimit: 6
  },
  {
    classLevel: 13,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 2 },
      { spellLevel: 6, slotCount: 1 },
      { spellLevel: 7, slotCount: 1 }
    ],
    learnedSpellsLimit: 13,
    cantripsLimit: 6
  },
  {
    classLevel: 14,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 2 },
      { spellLevel: 6, slotCount: 1 },
      { spellLevel: 7, slotCount: 1 }
    ],
    learnedSpellsLimit: 13,
    cantripsLimit: 6
  },
  {
    classLevel: 15,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 2 },
      { spellLevel: 6, slotCount: 1 },
      { spellLevel: 7, slotCount: 1 },
      { spellLevel: 8, slotCount: 1 }
    ],
    learnedSpellsLimit: 14,
    cantripsLimit: 6
  },
  {
    classLevel: 16,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 2 },
      { spellLevel: 6, slotCount: 1 },
      { spellLevel: 7, slotCount: 1 },
      { spellLevel: 8, slotCount: 1 }
    ],
    learnedSpellsLimit: 14,
    cantripsLimit: 6
  },
  {
    classLevel: 17,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 2 },
      { spellLevel: 6, slotCount: 1 },
      { spellLevel: 7, slotCount: 1 },
      { spellLevel: 8, slotCount: 1 },
      { spellLevel: 9, slotCount: 1 }
    ],
    learnedSpellsLimit: 15,
    cantripsLimit: 6
  },
  {
    classLevel: 18,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 3 },
      { spellLevel: 6, slotCount: 1 },
      { spellLevel: 7, slotCount: 1 },
      { spellLevel: 8, slotCount: 1 },
      { spellLevel: 9, slotCount: 1 }
    ],
    learnedSpellsLimit: 15,
    cantripsLimit: 6
  },
  {
    classLevel: 19,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 3 },
      { spellLevel: 6, slotCount: 2 },
      { spellLevel: 7, slotCount: 1 },
      { spellLevel: 8, slotCount: 1 },
      { spellLevel: 9, slotCount: 1 }
    ],
    learnedSpellsLimit: 15,
    cantripsLimit: 6
  },
  {
    classLevel: 20,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 3 },
      { spellLevel: 6, slotCount: 2 },
      { spellLevel: 7, slotCount: 2 },
      { spellLevel: 8, slotCount: 1 },
      { spellLevel: 9, slotCount: 1 }
    ],
    learnedSpellsLimit: 15,
    cantripsLimit: 6
  }
]

// Sorcery Points charge — resets on long rest
const sorceryPointsCharge = {
  id: classRowId(S, 2, 1),
  limitKind: 'CLASS_LEVEL' as const,
  scalingKind: SCALING.NONE,
  classId: CLASS_IDS.SORCERER,
  resetKind: 'LONG_REST' as const
}

export const sorcerer: ClassAuthored = {
  id: CLASS_IDS.SORCERER,
  label: 'Sorcerer',
  category: CLASS_CATEGORY.BASE,
  subclassSelectionLevel: 1,
  attributes: [CLASS_ATTRIBUTE.SPELLCASTER, CLASS_ATTRIBUTE.RESOURCE],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,

  hitpoint: {
    dieConfig: 'd6'
  },

  startingGold: {
    multiplier: 10,
    currencyId: goldCurrencyId,
    dieConfig: '3d4'
  },

  multiclass: {
    id: classRowId(S, 99, 1),
    requirementGroups: {
      groups: [
        {
          id: classRowId(S, 99, 2),
          requirements: [{ id: classRowId(S, 99, 3), ability: ABILITY_CODE.CHARISMA, min: 13 }]
        }
      ]
    }
  },

  startingEquipment: {
    id: classRowId(S, 98, 1),
    sets: [
      {
        id: classRowId(S, 98, 2),
        order: 0,
        groups: [
          {
            id: classRowId(S, 98, 3),
            order: 0,
            options: [
              {
                id: classRowId(S, 98, 4),
                order: 0,
                items: [
                  {
                    id: classRowId(S, 98, 5),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(11)],
                    quantity: 1
                  },
                  {
                    id: classRowId(S, 98, 6),
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
                id: classRowId(S, 98, 7),
                order: 1,
                items: [
                  {
                    id: classRowId(S, 98, 8),
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
            id: classRowId(S, 98, 9),
            order: 1,
            options: [
              {
                id: classRowId(S, 98, 10),
                order: 0,
                items: [
                  {
                    id: classRowId(S, 98, 11),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(135)],
                    quantity: 1
                  }
                ]
              },
              {
                id: classRowId(S, 98, 12),
                order: 1,
                items: [
                  {
                    id: classRowId(S, 98, 13),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [87, 88, 89, 90, 91].map(equipmentId),
                    count: 1
                  }
                ]
              }
            ]
          },
          {
            id: classRowId(S, 98, 14),
            order: 2,
            options: [
              {
                id: classRowId(S, 98, 15),
                order: 0,
                items: [
                  {
                    id: classRowId(S, 98, 16),
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
                id: classRowId(S, 98, 17),
                order: 1,
                items: [
                  {
                    id: classRowId(S, 98, 18),
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
            id: classRowId(S, 98, 19),
            order: 3,
            options: [
              {
                id: classRowId(S, 98, 20),
                order: 0,
                items: [
                  {
                    id: classRowId(S, 98, 21),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(2)],
                    quantity: 2
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },

  spellcasting: {
    availableAtLevel: 1,
    order: 0,
    ability: ABILITY_CODE.CHARISMA,
    maxSpellLevel: 9,
    attributes: [SPELLCASTING_ATTRIBUTE.LIMIT_KNOWN_SPELL_AMOUNT],
    details: classSpellcastingDetails(S, [
      {
        label: 'Spellcasting',
        description:
          '<p>An event in your past, or in the life of a parent or ancestor, left an indelible mark on you, infusing you with arcane magic. This font of magic, whatever its origin, fuels your spells.</p>'
      },
      {
        label: 'Cantrips',
        description:
          '<p>At 1st level, you know four cantrips of your choice from the sorcerer spell list. You learn additional sorcerer cantrips of your choice at higher levels, as shown in the Cantrips Known column of the Sorcerer table.</p>'
      },
      {
        label: 'Spell Slots',
        description:
          "<p>The Sorcerer table shows how many spell slots you have to cast your spells of 1st level and higher. To cast one of these sorcerer spells, you must expend a slot of the spell's level or higher. You regain all expended spell slots when you finish a long rest.</p><p>For example, if you know the 1st-level spell <em>burning hands</em> and have a 1st-level and a 2nd-level spell slot available, you can cast <em>burning hands</em> using either slot.</p>"
      },
      {
        label: 'Spells Known of 1st Level and Higher',
        description:
          '<p>You know two 1st-level spells of your choice from the sorcerer spell list.</p><p>The Spells Known column of the Sorcerer table shows when you learn more sorcerer spells of your choice. Each of these spells must be of a level for which you have spell slots. For instance, when you reach 3rd level in this class, you can learn one new spell of 1st or 2nd level.</p><p>Additionally, when you gain a level in this class, you can choose one of the sorcerer spells you know and replace it with another spell from the sorcerer spell list, which also must be of a level for which you have spell slots.</p>'
      },
      {
        label: 'Spellcasting Ability',
        description:
          '<p>Charisma is your spellcasting ability for your sorcerer spells, since the power of your magic relies on your ability to project your will into the world. You use your Charisma whenever a spell refers to your spellcasting ability. In addition, you use your Charisma modifier when setting the saving throw DC for a sorcerer spell you cast and when making an attack roll with one.</p><p><strong>Spell save DC</strong> = 8 + your proficiency bonus + your Charisma modifier</p><p><strong>Spell attack modifier</strong> = your proficiency bonus + your Charisma modifier</p>'
      },
      {
        label: 'Spellcasting Focus',
        description:
          '<p>You can use an arcane focus as a spellcasting focus for your sorcerer spells.</p>'
      }
    ]),
    charges: sorcererSlotCharge,
    spellLimits: sorcererSpellLimits
  },

  proficiencies: [
    // Weapons: daggers, darts, slings, quarterstaffs, light crossbows
    {
      id: classRowId(S, 3, 1),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      equipmentIds: [2, 12, 14, 8, 11].map(equipmentId),
      order: 0
    },
    // Saving throws: CON, CHA
    {
      id: classRowId(S, 3, 2),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SAVE_ABILITY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      abilities: [ABILITY_CODE.CONSTITUTION, ABILITY_CODE.CHARISMA],
      order: 1
    },
    // Skills: choose 2 from Arcana, Deception, Insight, Intimidation, Persuasion, Religion
    {
      id: classRowId(S, 3, 3),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SKILL,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
      scalingKind: SCALING.NONE,
      count: 2,
      selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      skillIds: [
        skillId('ARCANA'),
        skillId('DECEPTION'),
        skillId('INSIGHT'),
        skillId('INTIMIDATION'),
        skillId('PERSUASION'),
        skillId('RELIGION')
      ],
      order: 2
    }
  ],

  resources: {
    order: 1,
    id: classRowId(S, 5, 1),
    label: 'Sorcery Points',
    availableAtLevel: 2,
    charges: sorceryPointsCharge
  },

  features: [
    {
      id: classRowId(S, 4, 1),
      label: 'Spellcasting',
      description:
        'An event in your past, or in the life of a parent or ancestor, left an indelible mark on you, infusing you with arcane magic. This font of magic, whatever its origin, fuels your spells.',
      availableAtLevel: 1,
      order: 0
    },
    {
      id: classRowId(S, 4, 2),
      label: 'Sorcerous Origin',
      description:
        'Choose a sorcerous origin, which describes the source of your innate magical power, such as Draconic Bloodline.\n\nYour choice grants you features when you choose it at 1st level and again at 6th, 14th, and 18th level.',
      attributes: [FEATURE_ATTRIBUTE.SUBCLASS_SELECTION],
      availableAtLevel: 1,
      order: 1
    },
    {
      id: classRowId(S, 4, 3),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 4,
      order: 2,
      optionChoices: [{ level: 4, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(S, 6, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(40, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(S, 4, 4),
      label: 'Font of Magic',
      description:
        "At 2nd level, you tap into a deep wellspring of magic within yourself. This wellspring is represented by sorcery points, which allow you to create a variety of magical effects.\n\nSorcery Points\n\nYou have 2 sorcery points, and you gain more as you reach higher levels, as shown in the Sorcery Points column of the Sorcerer table. You can never have more sorcery points than shown on the table for your level. You regain all spent sorcery points when you finish a long rest.\n\nFlexible Casting\n\nYou can use your sorcery points to gain additional spell slots, or sacrifice spell slots to gain additional sorcery points. You learn other ways to use your sorcery points as you reach higher levels.\n\nCreating Spell Slots. You can transform unexpended sorcery points into one spell slot as a bonus action on your turn. The Creating Spell Slots table shows the cost of creating a spell slot of a given level. You can create spell slots no higher in level than 5th.\n\nAny spell slot you create with this feature vanishes when you finish a long rest.\n\nConverting a Spell Slot to Sorcery Points. As a bonus action on your turn, you can expend one spell slot and gain a number of sorcery points equal to the slot's level.",
      effects: [
        selfClassRuleEffect(
          4,
          CLOSED_RULE_KIND.CLASS_SORCERER_FLEXIBLE_CASTING,
          ACTIVATION_CODE.BONUS_ACTION
        )
      ],
      availableAtLevel: 2,
      order: 3
    },
    {
      id: classRowId(S, 4, 5),
      label: 'Metamagic',
      description:
        'At 3rd level, you gain the ability to twist your spells to suit your needs. You gain two of the following Metamagic options of your choice. You gain another one at 10th and 17th level.\n\nYou can use only one Metamagic option on a spell when you cast it, unless otherwise noted.',
      availableAtLevel: 3,
      order: 4,
      optionChoices: [
        { level: 3, count: 2 },
        { level: 10, count: 1 },
        { level: 17, count: 1 }
      ],
      options: [
        {
          id: classRowId(S, 13, 1),
          label: 'Careful Spell',
          description:
            "When you cast a spell that forces other creatures to make a saving throw, you can protect some of those creatures from the spell's full force. To do so, you spend 1 sorcery point and choose a number of those creatures up to your Charisma modifier (minimum of one creature). A chosen creature automatically succeeds on its saving throw against the spell.",
          effects: [
            closedRuleEffect({
              id: classRowId(S, 0x60, 20),
              ruleKind: CLOSED_RULE_KIND.CLASS_SORCERER_METAMAGIC_CAREFUL,
              invocation: {
                kind: 'PASSIVE',
                triggerCode: TRIGGER.ACTIVATED,
                range: { id: classRowId(S, 0x69, 20), rangeKind: RANGE_KIND.SPECIAL },
                targeting: {
                  selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
                  dispositionKind: TARGET_DISPOSITION_KIND.ANY
                }
              }
            })
          ],
          order: 0
        },
        {
          id: classRowId(S, 13, 2),
          label: 'Distant Spell',
          description:
            'When you cast a spell that has a range of 5 feet or greater, you can spend 1 sorcery point to double the range of the spell. When you cast a spell that has a range of touch, you can spend 1 sorcery point to make the range of the spell 30 feet.',
          effects: [selfClassRuleEffect(21, CLOSED_RULE_KIND.CLASS_SORCERER_METAMAGIC_DISTANT)],
          order: 1
        },
        {
          id: classRowId(S, 13, 3),
          label: 'Empowered Spell',
          description:
            'When you roll damage for a spell, you can spend 1 sorcery point to reroll a number of the damage dice up to your Charisma modifier (minimum of one). You must use the new rolls. You can use Empowered Spell even if you have already used a different Metamagic option during the casting of the spell.',
          effects: [selfClassRuleEffect(22, CLOSED_RULE_KIND.CLASS_SORCERER_METAMAGIC_EMPOWERED)],
          order: 2
        },
        {
          id: classRowId(S, 13, 4),
          label: 'Extended Spell',
          description:
            'When you cast a spell that has a duration of 1 minute or longer, you can spend 1 sorcery point to double its duration, to a maximum duration of 24 hours.',
          effects: [selfClassRuleEffect(23, CLOSED_RULE_KIND.CLASS_SORCERER_METAMAGIC_EXTENDED)],
          order: 3
        },
        {
          id: classRowId(S, 13, 5),
          label: 'Heightened Spell',
          description:
            'When you cast a spell that forces a creature to make a saving throw to resist its effects, you can spend 3 sorcery points to give one target of the spell disadvantage on its first saving throw made against the spell.',
          effects: [
            closedRuleEffect({
              id: classRowId(S, 0x60, 24),
              ruleKind: CLOSED_RULE_KIND.CLASS_SORCERER_METAMAGIC_HEIGHTENED,
              invocation: {
                kind: 'PASSIVE',
                triggerCode: TRIGGER.ACTIVATED,
                range: { id: classRowId(S, 0x69, 24), rangeKind: RANGE_KIND.SPECIAL },
                targeting: {
                  selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                  dispositionKind: TARGET_DISPOSITION_KIND.HOSTILE
                }
              }
            })
          ],
          order: 4
        },
        {
          id: classRowId(S, 13, 6),
          label: 'Quickened Spell',
          description:
            'When you cast a spell that has a casting time of 1 action, you can spend 2 sorcery points to change the casting time to 1 bonus action for this casting.',
          effects: [selfClassRuleEffect(25, CLOSED_RULE_KIND.CLASS_SORCERER_METAMAGIC_QUICKENED)],
          order: 5
        },
        {
          id: classRowId(S, 13, 7),
          label: 'Subtle Spell',
          description:
            'When you cast a spell, you can spend 1 sorcery point to cast it without any somatic or verbal components.',
          effects: [selfClassRuleEffect(26, CLOSED_RULE_KIND.CLASS_SORCERER_METAMAGIC_SUBTLE)],
          order: 6
        },
        {
          id: classRowId(S, 13, 8),
          label: 'Twinned Spell',
          description:
            "When you cast a spell that targets only one creature and doesn't have a range of self, you can spend a number of sorcery points equal to the spell's level to target a second creature in range with the same spell (1 sorcery point if the spell is a cantrip).\n\nTo be eligible, a spell must be incapable of targeting more than one creature at the spell's current level. For example, magic missile and scorching ray aren't eligible, but ray of frost is.",
          effects: [
            closedRuleEffect({
              id: classRowId(S, 0x60, 27),
              ruleKind: CLOSED_RULE_KIND.CLASS_SORCERER_METAMAGIC_TWINNED,
              invocation: {
                kind: 'PASSIVE',
                triggerCode: TRIGGER.ACTIVATED,
                range: { id: classRowId(S, 0x69, 27), rangeKind: RANGE_KIND.SPECIAL },
                targeting: {
                  selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
                  dispositionKind: TARGET_DISPOSITION_KIND.ANY
                }
              }
            })
          ],
          order: 7
        }
      ]
    },
    {
      id: classRowId(S, 4, 6),
      label: 'Sorcerous Origin Feature',
      description:
        'Choose a sorcerous origin, which describes the source of your innate magical power, such as Draconic Bloodline.\n\nYour choice grants you features when you choose it at 1st level and again at 6th, 14th, and 18th level.',
      availableAtLevel: 6,
      order: 5
    },
    {
      id: classRowId(S, 4, 7),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 8,
      order: 6,
      optionChoices: [{ level: 8, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(S, 7, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(41, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(S, 4, 8),
      label: 'Metamagic',
      description:
        'At 3rd level, you gain the ability to twist your spells to suit your needs. You gain two of the following Metamagic options of your choice. You gain another one at 10th and 17th level.\n\nYou can use only one Metamagic option on a spell when you cast it, unless otherwise noted.',
      availableAtLevel: 10,
      order: 7
    },
    {
      id: classRowId(S, 4, 9),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 12,
      order: 8,
      optionChoices: [{ level: 12, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(S, 8, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(42, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(S, 4, 10),
      label: 'Sorcerous Origin Feature',
      description:
        'Choose a sorcerous origin, which describes the source of your innate magical power, such as Draconic Bloodline.\n\nYour choice grants you features when you choose it at 1st level and again at 6th, 14th, and 18th level.',
      availableAtLevel: 14,
      order: 9
    },
    {
      id: classRowId(S, 4, 11),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 16,
      order: 10,
      optionChoices: [{ level: 16, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(S, 9, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(43, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(S, 4, 12),
      label: 'Metamagic',
      description:
        'At 3rd level, you gain the ability to twist your spells to suit your needs. You gain two of the following Metamagic options of your choice. You gain another one at 10th and 17th level.\n\nYou can use only one Metamagic option on a spell when you cast it, unless otherwise noted.',
      availableAtLevel: 17,
      order: 11
    },
    {
      id: classRowId(S, 4, 13),
      label: 'Sorcerous Origin Feature',
      description:
        'Choose a sorcerous origin, which describes the source of your innate magical power, such as Draconic Bloodline.\n\nYour choice grants you features when you choose it at 1st level and again at 6th, 14th, and 18th level.',
      availableAtLevel: 18,
      order: 12
    },
    {
      id: classRowId(S, 4, 14),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 19,
      order: 13,
      optionChoices: [{ level: 19, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(S, 10, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(44, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(S, 4, 15),
      label: 'Sorcerous Restoration',
      description:
        'At 20th level, you regain 4 expended sorcery points whenever you finish a short rest.',
      effects: [selfClassRuleEffect(15, CLOSED_RULE_KIND.CLASS_SORCERER_SORCEROUS_RESTORATION)],
      availableAtLevel: 20,
      order: 14
    }
  ]
}
