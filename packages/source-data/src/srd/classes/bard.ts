import {
  ACTIVATION_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_DUPLICATE_POLICY,
  AUTHORING_SELECTION_KIND,
  CHARGE_RESET_KIND,
  CLASS_ATTRIBUTE,
  CLASS_CATEGORY,
  CLOSED_RULE_KIND,
  EFFECT_KIND,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  FEATURE_ATTRIBUTE,
  GRANT_KIND,
  MANUAL_ADJUDICATION_REASON,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  MEASUREMENT_UNIT_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  PROFICIENCY_KIND,
  RANGE_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  SPELL_GRANT_ATTRIBUTE,
  SPELLCASTING_ATTRIBUTE,
  STARTING_EQUIPMENT_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  type ActivationCode,
  type ClassAuthored,
  type ClosedRuleKind,
  type EffectAuthored,
  type SpellGrantAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS } from '../ids.js'
import { srdSpells } from '../spells/index.js'
import { classSpellcastingDetails } from './spellcasting-details.js'
import {
  SRD_CURRENCIES,
  SRD_SKILLS,
  SRD_SYSTEM_ID,
  SRD_USER_ID,
  ABILITY_CODE
} from '../vocabulary.js'
import {
  abilityScoreImprovementOptions,
  closedRuleEffect,
  gmRulingEffect,
  MUSICAL_INSTRUMENT_EQUIPMENT_INDEXES
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

const BD = 2 // Bard class index

/**
 * Magical Secrets: two chosen spells from any class, of a level the Bard can cast (or a cantrip),
 * known as bard spells. The same core spell grant as Lore's Additional Magical Secrets.
 */
function magicalSecretsGrant(entry: number, maxSpellLevel: number): SpellGrantAuthored {
  return {
    id: classRowId(BD, 0x70, entry),
    grantKind: GRANT_KIND.SPELL_GRANT,
    selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
    count: 2,
    selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
    scalingKind: SCALING.NONE,
    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
    spellIds: srdSpells.filter((spell) => spell.level <= maxSpellLevel).map((spell) => spell.id),
    attributes: [SPELL_GRANT_ATTRIBUTE.KNOWN],
    order: 0
  }
}
const abilityScoreImprovementDescription =
  "When you reach 4th level, and again at 8th, 12th, 16th, and 19th level, you can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1. As normal, you can't increase an ability score above 20 using this feature."
const bardicInspirationDescription =
  '<p>You can inspire others through stirring words or music. To do so, you use a bonus action on your turn to choose one creature other than yourself within 60 feet of you who can hear you. That creature gains one Bardic Inspiration die, a d6.</p><p>Once within the next 10 minutes, the creature can roll the die and add the number rolled to one ability check, attack roll, or saving throw it makes. The creature can wait until after it rolls the d20 before deciding to use the Bardic Inspiration die, but must decide before the GM says whether the roll succeeds or fails. Once the Bardic Inspiration die is rolled, it is lost. A creature can have only one Bardic Inspiration die at a time.</p><p>You can use this feature a number of times equal to your Charisma modifier (a minimum of once). You regain any expended uses when you finish a long rest.</p><p>Your Bardic Inspiration die changes when you reach certain levels in this class. The die becomes a d8 at 5th level, a d10 at 10th level, and a d12 at 15th level.</p>'

function selfClassRuleEffect(
  entry: number,
  ruleKind: ClosedRuleKind,
  activationCode?: Exclude<ActivationCode, 'FREE'>
): EffectAuthored {
  const range = { id: classRowId(BD, 0x69, entry), rangeKind: RANGE_KIND.SELF } as const
  return closedRuleEffect({
    id: classRowId(BD, 0x60, entry),
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

// Bard spell slot charge — resets on long rest
const bardSlotCharge = {
  id: classRowId(BD, 1, 1),
  limitKind: 'FIXED_AMOUNT' as const,
  scalingKind: SCALING.PER_LEVEL,
  resetKind: 'LONG_REST' as const,
  levels: [
    { id: classRowId(BD, 1, 2), level: 1, amount: 2 },
    { id: classRowId(BD, 1, 3), level: 2, amount: 3 },
    { id: classRowId(BD, 1, 4), level: 3, amount: 4 },
    { id: classRowId(BD, 1, 5), level: 4, amount: 4 },
    { id: classRowId(BD, 1, 6), level: 5, amount: 4 },
    { id: classRowId(BD, 1, 7), level: 6, amount: 4 },
    { id: classRowId(BD, 1, 8), level: 7, amount: 4 },
    { id: classRowId(BD, 1, 9), level: 8, amount: 4 },
    { id: classRowId(BD, 1, 10), level: 9, amount: 4 },
    { id: classRowId(BD, 1, 11), level: 10, amount: 5 },
    { id: classRowId(BD, 1, 12), level: 11, amount: 5 },
    { id: classRowId(BD, 1, 13), level: 12, amount: 5 },
    { id: classRowId(BD, 1, 14), level: 13, amount: 5 },
    { id: classRowId(BD, 1, 15), level: 14, amount: 5 },
    { id: classRowId(BD, 1, 16), level: 15, amount: 5 },
    { id: classRowId(BD, 1, 17), level: 16, amount: 5 },
    { id: classRowId(BD, 1, 18), level: 17, amount: 5 },
    { id: classRowId(BD, 1, 19), level: 18, amount: 5 },
    { id: classRowId(BD, 1, 20), level: 19, amount: 5 },
    { id: classRowId(BD, 1, 21), level: 20, amount: 5 }
  ]
}

// Bard spell slots per level (full caster progression)
const bardSpellLimits = [
  {
    classLevel: 1,
    slots: [{ spellLevel: 1, slotCount: 2 }],
    learnedSpellsLimit: 4,
    cantripsLimit: 2
  },
  {
    classLevel: 2,
    slots: [{ spellLevel: 1, slotCount: 3 }],
    learnedSpellsLimit: 5,
    cantripsLimit: 2
  },
  {
    classLevel: 3,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 2 }
    ],
    learnedSpellsLimit: 6,
    cantripsLimit: 2
  },
  {
    classLevel: 4,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 }
    ],
    learnedSpellsLimit: 7,
    cantripsLimit: 3
  },
  {
    classLevel: 5,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 2 }
    ],
    learnedSpellsLimit: 8,
    cantripsLimit: 3
  },
  {
    classLevel: 6,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 }
    ],
    learnedSpellsLimit: 9,
    cantripsLimit: 3
  },
  {
    classLevel: 7,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 1 }
    ],
    learnedSpellsLimit: 10,
    cantripsLimit: 3
  },
  {
    classLevel: 8,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 2 }
    ],
    learnedSpellsLimit: 11,
    cantripsLimit: 3
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
    learnedSpellsLimit: 12,
    cantripsLimit: 3
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
    learnedSpellsLimit: 14,
    cantripsLimit: 4
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
    learnedSpellsLimit: 15,
    cantripsLimit: 4
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
    learnedSpellsLimit: 15,
    cantripsLimit: 4
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
    learnedSpellsLimit: 16,
    cantripsLimit: 4
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
    learnedSpellsLimit: 18,
    cantripsLimit: 4
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
    learnedSpellsLimit: 19,
    cantripsLimit: 4
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
    learnedSpellsLimit: 19,
    cantripsLimit: 4
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
    learnedSpellsLimit: 20,
    cantripsLimit: 4
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
    learnedSpellsLimit: 22,
    cantripsLimit: 4
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
    learnedSpellsLimit: 22,
    cantripsLimit: 4
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
    learnedSpellsLimit: 22,
    cantripsLimit: 4
  }
]

const bardicInspirationCharge = {
  id: classRowId(BD, 5, 2),
  limitKind: 'ABILITY_MODIFIER' as const,
  scalingKind: SCALING.NONE,
  resetKind: CHARGE_RESET_KIND.LONG_REST,
  ability: ABILITY_CODE.CHARISMA,
  min: 1
}

function equipmentId(index: number): string {
  const hex = index.toString(16).padStart(4, '0')
  return `00000000-0000-0000-0060-${hex}00000000`
}

export const bard: ClassAuthored = {
  id: CLASS_IDS.BARD,
  label: 'Bard',
  category: CLASS_CATEGORY.BASE,
  subclassSelectionLevel: 3,
  attributes: [CLASS_ATTRIBUTE.SPELLCASTER],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,

  hitpoint: {
    dieConfig: 'd8'
  },

  startingGold: {
    multiplier: 10,
    currencyId: goldCurrencyId,
    dieConfig: '5d4'
  },

  multiclass: {
    id: classRowId(BD, 99, 1),
    requirementGroups: {
      groups: [
        {
          id: classRowId(BD, 99, 2),
          requirements: [{ id: classRowId(BD, 99, 3), ability: ABILITY_CODE.CHARISMA, min: 13 }]
        }
      ]
    },
    proficiencies: [
      {
        id: classRowId(BD, 99, 4),
        grantKind: GRANT_KIND.PROFICIENCY_GRANT,
        proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
        level: SCALING_AMOUNT_KIND.FULL,
        selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
        scalingKind: SCALING.NONE,
        authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
        properties: ['LIGHT'],
        category: 'ARMOR',
        order: 0
      },
      // One skill of your choice
      {
        id: classRowId(BD, 99, 5),
        grantKind: GRANT_KIND.PROFICIENCY_GRANT,
        proficiencyKind: PROFICIENCY_KIND.SKILL,
        level: SCALING_AMOUNT_KIND.FULL,
        selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
        scalingKind: SCALING.NONE,
        count: 1,
        selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
        authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
        skillIds: SRD_SKILLS.map((skill) => skill.id),
        order: 1
      },
      // One musical instrument of your choice
      {
        id: classRowId(BD, 99, 6),
        grantKind: GRANT_KIND.PROFICIENCY_GRANT,
        proficiencyKind: PROFICIENCY_KIND.EQUIPMENT,
        level: SCALING_AMOUNT_KIND.FULL,
        selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
        scalingKind: SCALING.NONE,
        count: 1,
        selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
        authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
        equipmentIds: MUSICAL_INSTRUMENT_EQUIPMENT_INDEXES.map(equipmentId),
        order: 2
      }
    ]
  },

  startingEquipment: {
    id: classRowId(BD, 98, 1),
    sets: [
      {
        id: classRowId(BD, 98, 2),
        order: 0,
        groups: [
          {
            id: classRowId(BD, 98, 3),
            order: 0,
            options: [
              {
                id: classRowId(BD, 98, 4),
                order: 0,
                items: [
                  {
                    id: classRowId(BD, 98, 5),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(26)],
                    quantity: 1
                  }
                ]
              },
              {
                id: classRowId(BD, 98, 6),
                order: 1,
                items: [
                  {
                    id: classRowId(BD, 98, 7),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(22)],
                    quantity: 1
                  }
                ]
              },
              {
                id: classRowId(BD, 98, 8),
                order: 2,
                items: [
                  {
                    id: classRowId(BD, 98, 9),
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
            id: classRowId(BD, 98, 10),
            order: 1,
            options: [
              {
                id: classRowId(BD, 98, 11),
                order: 0,
                items: [
                  {
                    id: classRowId(BD, 98, 12),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(183)],
                    quantity: 1
                  }
                ]
              },
              {
                id: classRowId(BD, 98, 13),
                order: 1,
                items: [
                  {
                    id: classRowId(BD, 98, 14),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(185)],
                    quantity: 1
                  }
                ]
              }
            ]
          },
          {
            id: classRowId(BD, 98, 15),
            order: 2,
            options: [
              {
                id: classRowId(BD, 98, 16),
                order: 0,
                items: [
                  {
                    id: classRowId(BD, 98, 17),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
                    authoringModeKind: AUTHORING_MODE_KIND.ALL,
                    properties: [EQUIPMENT_PROPERTY_CODE.MUSICAL_INSTRUMENT],
                    count: 1
                  }
                ]
              }
            ]
          },
          {
            id: classRowId(BD, 98, 20),
            order: 3,
            options: [
              {
                id: classRowId(BD, 98, 21),
                order: 0,
                items: [
                  {
                    id: classRowId(BD, 98, 22),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(39)],
                    quantity: 1
                  },
                  {
                    id: classRowId(BD, 98, 23),
                    order: 1,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(2)],
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

  resources: {
    id: classRowId(BD, 5, 1),
    label: 'Bardic Inspiration',
    availableAtLevel: 1,
    order: 1,
    charges: bardicInspirationCharge
  },

  spellcasting: {
    availableAtLevel: 1,
    order: 0,
    ability: ABILITY_CODE.CHARISMA,
    maxSpellLevel: 9,
    attributes: [SPELLCASTING_ATTRIBUTE.LIMIT_KNOWN_SPELL_AMOUNT],
    details: classSpellcastingDetails(BD, [
      {
        label: 'Spellcasting',
        description:
          '<p>You have learned to untangle and reshape the fabric of reality in harmony with your wishes and music. Your spells are part of your vast repertoire, magic that you can tune to different situations.</p>'
      },
      {
        label: 'Cantrips',
        description:
          '<p>You know two cantrips of your choice from the bard spell list. You learn additional bard cantrips of your choice at higher levels, as shown in the Cantrips Known column of the Bard table.</p>'
      },
      {
        label: 'Spell Slots',
        description:
          "<p>The Bard table shows how many spell slots you have to cast your spells of 1st level and higher. To cast one of these spells, you must expend a slot of the spell's level or higher. You regain all expended spell slots when you finish a long rest.</p><p>For example, if you know the 1st-level spell <em>cure wounds</em> and have a 1st-level and a 2nd-level spell slot available, you can cast <em>cure wounds</em> using either slot.</p>"
      },
      {
        label: 'Spells Known of 1st Level and Higher',
        description:
          '<p>You know four 1st-level spells of your choice from the bard spell list.</p><p>The Spells Known column of the Bard table shows when you learn more bard spells of your choice. Each of these spells must be of a level for which you have spell slots, as shown on the table. For instance, when you reach 3rd level in this class, you can learn one new spell of 1st or 2nd level.</p><p>Additionally, when you gain a level in this class, you can choose one of the bard spells you know and replace it with another spell from the bard spell list, which also must be of a level for which you have spell slots.</p>'
      },
      {
        label: 'Spellcasting Ability',
        description:
          '<p>Charisma is your spellcasting ability for your bard spells. Your magic comes from the heart and soul you pour into the performance of your music or oration. You use your Charisma whenever a spell refers to your spellcasting ability. In addition, you use your Charisma modifier when setting the saving throw DC for a bard spell you cast and when making an attack roll with one.</p><p><strong>Spell save DC</strong> = 8 + your proficiency bonus + your Charisma modifier</p><p><strong>Spell attack modifier</strong> = your proficiency bonus + your Charisma modifier</p>'
      },
      {
        label: 'Ritual Casting',
        description:
          '<p>You can cast any bard spell you know as a ritual if that spell has the ritual tag.</p>'
      },
      {
        label: 'Spellcasting Focus',
        description:
          '<p>You can use a musical instrument (see "Equipment") as a spellcasting focus for your bard spells.</p>'
      }
    ]),
    charges: bardSlotCharge,
    spellLimits: bardSpellLimits
  },

  proficiencies: [
    // Light armor
    {
      id: classRowId(BD, 2, 1),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      properties: ['LIGHT'],
      category: 'ARMOR',
      order: 0
    },
    // Simple weapons
    {
      id: classRowId(BD, 2, 2),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      properties: ['SIMPLE'],
      category: 'WEAPON',
      order: 1
    },
    // Saving throws: DEX, CHA
    {
      id: classRowId(BD, 2, 3),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SAVE_ABILITY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      abilities: [ABILITY_CODE.DEXTERITY, ABILITY_CODE.CHARISMA],
      order: 2
    },
    // Skills: choose any 3
    {
      id: classRowId(BD, 2, 4),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SKILL,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
      scalingKind: SCALING.NONE,
      count: 3,
      selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      skillIds: [
        skillId('ACROBATICS'),
        skillId('ANIMAL_HANDLING'),
        skillId('ARCANA'),
        skillId('ATHLETICS'),
        skillId('DECEPTION'),
        skillId('HISTORY'),
        skillId('INSIGHT'),
        skillId('INTIMIDATION'),
        skillId('INVESTIGATION'),
        skillId('MEDICINE'),
        skillId('NATURE'),
        skillId('PERCEPTION'),
        skillId('PERFORMANCE'),
        skillId('PERSUASION'),
        skillId('RELIGION'),
        skillId('SLEIGHT_OF_HAND'),
        skillId('STEALTH'),
        skillId('SURVIVAL')
      ],
      order: 3
    },
    // Weapons: hand crossbows, longswords, rapiers, shortswords
    {
      id: classRowId(BD, 2, 5),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      equipmentIds: [34, 22, 26, 28].map(equipmentId),
      order: 4
    },
    // Tools: three musical instruments of your choice
    {
      id: classRowId(BD, 2, 6),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
      scalingKind: SCALING.NONE,
      count: 3,
      selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      equipmentIds: MUSICAL_INSTRUMENT_EQUIPMENT_INDEXES.map(equipmentId),
      order: 5
    }
  ],

  features: [
    {
      id: classRowId(BD, 3, 1),
      label: 'Bardic Inspiration',
      description: bardicInspirationDescription,
      effects: [
        closedRuleEffect({
          id: classRowId(BD, 0x60, 1),
          ruleKind: CLOSED_RULE_KIND.CLASS_BARD_BARDIC_INSPIRATION,
          invocation: {
            kind: 'ACTION',
            triggerCode: TRIGGER.ACTIVATED,
            activation: { code: ACTIVATION_CODE.BONUS_ACTION, amount: 1 },
            range: {
              id: classRowId(BD, 0x69, 1),
              rangeKind: RANGE_KIND.DISTANCE,
              amount: 60,
              unit: MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: 'ANY',
              self: 'WARN'
            }
          }
        })
      ],
      availableAtLevel: 1,
      order: 0
    },
    {
      id: classRowId(BD, 3, 3),
      label: 'Jack of All Trades',
      description:
        "Starting at 2nd level, you can add half your proficiency bonus, rounded down, to any ability check you make that doesn't already include your proficiency bonus.",
      availableAtLevel: 2,
      order: 2,
      effects: [selfClassRuleEffect(3, CLOSED_RULE_KIND.CLASS_BARD_JACK_OF_ALL_TRADES)]
    },
    {
      id: classRowId(BD, 3, 4),
      label: 'Song of Rest',
      description:
        'Beginning at 2nd level, you can use soothing music or oration to help revitalize your wounded allies during a short rest. If you or any friendly creatures who can hear your performance regain hit points at the end of the short rest by spending one or more Hit Dice, each of those creatures regains an extra 1d6 hit points. The extra hit points increase when you reach certain levels in this class: to 1d8 at 9th level, to 1d10 at 13th level, and to 1d12 at 17th level.',
      availableAtLevel: 2,
      order: 3,
      effects: [
        gmRulingEffect({
          ids: {
            effect: classRowId(BD, 0x60, 4),
            range: classRowId(BD, 0x69, 4),
            path: classRowId(BD, 0x80, 4),
            result: classRowId(BD, 0x81, 4),
            outcome: classRowId(BD, 0x82, 4)
          },
          label: 'Song of Rest',
          instructions:
            'When you or any friendly creature who can hear your performance regains hit points at the end of a short rest by spending one or more Hit Dice, that creature regains an extra 1d6 hit points, increasing to 1d8 at 9th level, 1d10 at 13th level and 1d12 at 17th level. The GM applies the extra hit points.',
          reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE
        })
      ]
    },
    {
      id: classRowId(BD, 3, 5),
      label: 'Bard College',
      description:
        'At 3rd level, you delve into the advanced techniques of a bard college of your choice, such as the College of Lore. Your choice grants you features at 3rd level and again at 6th and 14th level.',
      attributes: [FEATURE_ATTRIBUTE.SUBCLASS_SELECTION],
      availableAtLevel: 3,
      order: 4
    },
    {
      id: classRowId(BD, 3, 6),
      label: 'Expertise',
      description:
        'At 3rd level, choose two of your skill proficiencies. Your proficiency bonus is doubled for any ability check you make that uses either of the chosen proficiencies.',
      availableAtLevel: 3,
      order: 5,
      grants: {
        proficiencies: [
          {
            id: classRowId(BD, 3, 60),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.SKILL,
            level: SCALING_AMOUNT_KIND.DOUBLE,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            count: 2,
            selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            skillIds: [
              skillId('ACROBATICS'),
              skillId('ANIMAL_HANDLING'),
              skillId('ARCANA'),
              skillId('ATHLETICS'),
              skillId('DECEPTION'),
              skillId('HISTORY'),
              skillId('INSIGHT'),
              skillId('INTIMIDATION'),
              skillId('INVESTIGATION'),
              skillId('MEDICINE'),
              skillId('NATURE'),
              skillId('PERCEPTION'),
              skillId('PERFORMANCE'),
              skillId('PERSUASION'),
              skillId('RELIGION'),
              skillId('SLEIGHT_OF_HAND'),
              skillId('STEALTH'),
              skillId('SURVIVAL')
            ],
            order: 0
          }
        ]
      }
    },
    {
      id: classRowId(BD, 3, 7),
      label: 'Ability Score Improvement',
      description: abilityScoreImprovementDescription,
      availableAtLevel: 4,
      order: 6,
      optionChoices: [{ level: 4, count: 1 }],
      options: abilityScoreImprovementOptions(
        (optionEntry) => classRowId(BD, 7, optionEntry),
        abilityScoreImprovementDescription
      ),
      effects: [selfClassRuleEffect(7, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)]
    },
    {
      id: classRowId(BD, 3, 8),
      label: 'Font of Inspiration',
      description:
        'Beginning when you reach 5th level, you regain all of your expended uses of Bardic Inspiration when you finish a short or long rest.',
      availableAtLevel: 5,
      order: 7,
      grants: {
        modifiers: [
          {
            id: classRowId(BD, 3, 80),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.CHARGE_RESET,
            domain: {},
            modifierKind: MODIFIER_KIND.REPLACE_CHARGE_RESET_KIND,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { resetKind: CHARGE_RESET_KIND.SHORT_REST },
            order: 0,
            restrictions: {
              id: classRowId(BD, 4, 1),
              groups: [
                {
                  id: classRowId(BD, 4, 2),
                  order: 0,
                  contexts: [
                    {
                      id: classRowId(BD, 4, 3),
                      order: 0,
                      subject: 'RESOURCE',
                      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                      resourceIds: [classRowId(BD, 5, 1)]
                    }
                  ]
                }
              ]
            }
          }
        ]
      }
    },
    {
      id: classRowId(BD, 3, 9),
      label: 'Countercharm',
      description:
        'At 6th level, you gain the ability to use musical notes or words of power to disrupt mind-influencing effects. As an action, you can start a performance that lasts until the end of your next turn. During that time, you and any friendly creatures within 30 feet of you have advantage on saving throws against being frightened or charmed. A creature must be able to hear you to gain this benefit. The performance ends early if you are incapacitated or silenced or if you voluntarily end it (no action required).',
      availableAtLevel: 6,
      order: 8,
      effects: [
        gmRulingEffect({
          ids: {
            effect: classRowId(BD, 0x60, 9),
            range: classRowId(BD, 0x69, 9),
            path: classRowId(BD, 0x80, 9),
            result: classRowId(BD, 0x81, 9),
            outcome: classRowId(BD, 0x82, 9)
          },
          label: 'Countercharm',
          instructions:
            'Until the end of your next turn, you and friendly creatures within 30 feet of you that can hear you have advantage on saving throws against being frightened or charmed. The GM applies the advantage and ends the performance early if you are incapacitated or silenced or choose to end it.',
          reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
          activationCode: ACTIVATION_CODE.ACTION
        })
      ]
    },
    {
      id: classRowId(BD, 3, 10),
      label: 'Bard College Feature',
      description:
        'At 3rd level, you delve into the advanced techniques of a bard college of your choice, such as the College of Lore. Your choice grants you features at 3rd level and again at 6th and 14th level.',
      availableAtLevel: 6,
      order: 9
    },
    {
      id: classRowId(BD, 3, 11),
      label: 'Ability Score Improvement',
      description: abilityScoreImprovementDescription,
      availableAtLevel: 8,
      order: 10,
      optionChoices: [{ level: 8, count: 1 }],
      options: abilityScoreImprovementOptions(
        (optionEntry) => classRowId(BD, 11, optionEntry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(11, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(BD, 3, 12),
      label: 'Expertise',
      description:
        'At 10th level, you can choose another two skill proficiencies to gain this benefit.',
      availableAtLevel: 10,
      order: 11,
      grants: {
        proficiencies: [
          {
            id: classRowId(BD, 3, 61),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.SKILL,
            level: SCALING_AMOUNT_KIND.DOUBLE,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            count: 2,
            selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            skillIds: [
              skillId('ACROBATICS'),
              skillId('ANIMAL_HANDLING'),
              skillId('ARCANA'),
              skillId('ATHLETICS'),
              skillId('DECEPTION'),
              skillId('HISTORY'),
              skillId('INSIGHT'),
              skillId('INTIMIDATION'),
              skillId('INVESTIGATION'),
              skillId('MEDICINE'),
              skillId('NATURE'),
              skillId('PERCEPTION'),
              skillId('PERFORMANCE'),
              skillId('PERSUASION'),
              skillId('RELIGION'),
              skillId('SLEIGHT_OF_HAND'),
              skillId('STEALTH'),
              skillId('SURVIVAL')
            ],
            order: 0
          }
        ]
      }
    },
    {
      id: classRowId(BD, 3, 13),
      label: 'Magical Secrets',
      description:
        'By 10th level, you have plundered magical knowledge from a wide spectrum of disciplines. Choose two spells from any class, including this one. A spell you choose must be of a level you can cast, as shown on the Bard table, or a cantrip. The chosen spells count as bard spells for you and are included in the number in the Spells Known column of the Bard table. You learn two additional spells from any class at 14th level and again at 18th level.',
      availableAtLevel: 10,
      order: 12,
      grants: { spells: [magicalSecretsGrant(13, 5)] }
    },
    {
      id: classRowId(BD, 3, 14),
      label: 'Ability Score Improvement',
      description: abilityScoreImprovementDescription,
      availableAtLevel: 12,
      order: 13,
      optionChoices: [{ level: 12, count: 1 }],
      options: abilityScoreImprovementOptions(
        (optionEntry) => classRowId(BD, 14, optionEntry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(14, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(BD, 3, 15),
      label: 'Bard College Feature',
      description:
        'At 3rd level, you delve into the advanced techniques of a bard college of your choice, such as the College of Lore. Your choice grants you features at 3rd level and again at 6th and 14th level.',
      availableAtLevel: 14,
      order: 14
    },
    {
      id: classRowId(BD, 3, 16),
      label: 'Magical Secrets',
      description:
        'By 10th level, you have plundered magical knowledge from a wide spectrum of disciplines. Choose two spells from any class, including this one. A spell you choose must be of a level you can cast, as shown on the Bard table, or a cantrip. The chosen spells count as bard spells for you and are included in the number in the Spells Known column of the Bard table. You learn two additional spells from any class at 14th level and again at 18th level.',
      availableAtLevel: 14,
      order: 15,
      grants: { spells: [magicalSecretsGrant(16, 7)] }
    },
    {
      id: classRowId(BD, 3, 17),
      label: 'Ability Score Improvement',
      description: abilityScoreImprovementDescription,
      availableAtLevel: 16,
      order: 16,
      optionChoices: [{ level: 16, count: 1 }],
      options: abilityScoreImprovementOptions(
        (optionEntry) => classRowId(BD, 17, optionEntry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(17, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(BD, 3, 18),
      label: 'Magical Secrets',
      description:
        'By 10th level, you have plundered magical knowledge from a wide spectrum of disciplines. Choose two spells from any class, including this one. A spell you choose must be of a level you can cast, as shown on the Bard table, or a cantrip. The chosen spells count as bard spells for you and are included in the number in the Spells Known column of the Bard table. You learn two additional spells from any class at 14th level and again at 18th level.',
      availableAtLevel: 18,
      order: 17,
      grants: { spells: [magicalSecretsGrant(18, 9)] }
    },
    {
      id: classRowId(BD, 3, 19),
      label: 'Ability Score Improvement',
      description: abilityScoreImprovementDescription,
      availableAtLevel: 19,
      order: 18,
      optionChoices: [{ level: 19, count: 1 }],
      options: abilityScoreImprovementOptions(
        (optionEntry) => classRowId(BD, 19, optionEntry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(19, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(BD, 3, 20),
      label: 'Superior Inspiration',
      description:
        'At 20th level, when you roll initiative and have no uses of Bardic Inspiration left, you regain one use.',
      availableAtLevel: 20,
      order: 19,
      effects: [
        {
          id: classRowId(BD, 0x60, 20),
          order: 1,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.ROLL_INITIATIVE,
            range: { id: classRowId(BD, 0x69, 20), rangeKind: RANGE_KIND.SELF },
            targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
          },
          paths: [
            {
              id: classRowId(BD, 0x80, 20),
              order: 1,
              pathCode: PATH_CODE.PASSIVE,
              groupType: PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: classRowId(BD, 0x81, 20),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: classRowId(BD, 0x82, 20),
                    effectKind: EFFECT_KIND.RESTORE_RESOURCE,
                    chargeId: bardicInspirationCharge.id,
                    floor: 1,
                    whenAtOrBelow: 0
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
