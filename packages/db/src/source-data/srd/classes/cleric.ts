import {
  ABILITY_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  CLASS_ATTRIBUTE,
  CLASS_CATEGORY,
  GRANT_KIND,
  PROFICIENCY_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  SPELLCASTING_ATTRIBUTE,
  type ClassAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SUBCLASS_IDS } from '../ids.js'
import {
  SRD_CURRENCIES,
  SRD_SKILLS,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from '../vocabulary.js'

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

const C = 3 // Cleric class index

// Cleric spell slot charge — resets on long rest (full caster)
const clericSlotCharge = {
  id: classRowId(C, 1, 1),
  limitKind: 'FIXED_AMOUNT' as const,
  scalingKind: SCALING.PER_LEVEL,
  resetKind: 'LONG_REST' as const,
  levels: [
    { id: classRowId(C, 1, 2), level: 1, amount: 2 },
    { id: classRowId(C, 1, 3), level: 2, amount: 3 },
    { id: classRowId(C, 1, 4), level: 3, amount: 4 },
    { id: classRowId(C, 1, 5), level: 4, amount: 4 },
    { id: classRowId(C, 1, 6), level: 5, amount: 4 },
    { id: classRowId(C, 1, 7), level: 6, amount: 4 },
    { id: classRowId(C, 1, 8), level: 7, amount: 4 },
    { id: classRowId(C, 1, 9), level: 8, amount: 4 },
    { id: classRowId(C, 1, 10), level: 9, amount: 4 },
    { id: classRowId(C, 1, 11), level: 10, amount: 5 },
    { id: classRowId(C, 1, 12), level: 11, amount: 5 },
    { id: classRowId(C, 1, 13), level: 12, amount: 5 },
    { id: classRowId(C, 1, 14), level: 13, amount: 5 },
    { id: classRowId(C, 1, 15), level: 14, amount: 5 },
    { id: classRowId(C, 1, 16), level: 15, amount: 5 },
    { id: classRowId(C, 1, 17), level: 16, amount: 5 },
    { id: classRowId(C, 1, 18), level: 17, amount: 5 },
    { id: classRowId(C, 1, 19), level: 18, amount: 5 },
    { id: classRowId(C, 1, 20), level: 19, amount: 5 },
    { id: classRowId(C, 1, 21), level: 20, amount: 5 }
  ]
}

const clericSpellLimits = [
  { classLevel: 1, slots: [{ spellLevel: 1, slotCount: 2 }], cantripsLimit: 3 },
  { classLevel: 2, slots: [{ spellLevel: 1, slotCount: 3 }], cantripsLimit: 3 },
  { classLevel: 3, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 2 }], cantripsLimit: 3 },
  { classLevel: 4, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }], cantripsLimit: 4 },
  { classLevel: 5, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 2 }], cantripsLimit: 4 },
  { classLevel: 6, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }], cantripsLimit: 4 },
  { classLevel: 7, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 1 }], cantripsLimit: 4 },
  { classLevel: 8, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 2 }], cantripsLimit: 4 },
  { classLevel: 9, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 1 }], cantripsLimit: 4 },
  { classLevel: 10, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }], cantripsLimit: 5 },
  { classLevel: 11, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }, { spellLevel: 6, slotCount: 1 }], cantripsLimit: 5 },
  { classLevel: 12, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }, { spellLevel: 6, slotCount: 1 }], cantripsLimit: 5 },
  { classLevel: 13, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }, { spellLevel: 6, slotCount: 1 }, { spellLevel: 7, slotCount: 1 }], cantripsLimit: 5 },
  { classLevel: 14, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }, { spellLevel: 6, slotCount: 1 }, { spellLevel: 7, slotCount: 1 }], cantripsLimit: 5 },
  { classLevel: 15, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }, { spellLevel: 6, slotCount: 1 }, { spellLevel: 7, slotCount: 1 }, { spellLevel: 8, slotCount: 1 }], cantripsLimit: 5 },
  { classLevel: 16, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }, { spellLevel: 6, slotCount: 1 }, { spellLevel: 7, slotCount: 1 }, { spellLevel: 8, slotCount: 1 }], cantripsLimit: 5 },
  { classLevel: 17, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }, { spellLevel: 6, slotCount: 1 }, { spellLevel: 7, slotCount: 1 }, { spellLevel: 8, slotCount: 1 }, { spellLevel: 9, slotCount: 1 }], cantripsLimit: 5 },
  { classLevel: 18, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 3 }, { spellLevel: 6, slotCount: 1 }, { spellLevel: 7, slotCount: 1 }, { spellLevel: 8, slotCount: 1 }, { spellLevel: 9, slotCount: 1 }], cantripsLimit: 5 },
  { classLevel: 19, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 3 }, { spellLevel: 6, slotCount: 2 }, { spellLevel: 7, slotCount: 1 }, { spellLevel: 8, slotCount: 1 }, { spellLevel: 9, slotCount: 1 }], cantripsLimit: 5 },
  { classLevel: 20, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 3 }, { spellLevel: 6, slotCount: 2 }, { spellLevel: 7, slotCount: 2 }, { spellLevel: 8, slotCount: 1 }, { spellLevel: 9, slotCount: 1 }], cantripsLimit: 5 }
]

export const cleric: ClassAuthored = {
  id: CLASS_IDS.CLERIC,
  label: 'Cleric',
  category: CLASS_CATEGORY.BASE,
  attributes: [CLASS_ATTRIBUTE.SPELLCASTER],
  description: 'A priestly champion who wields divine magic in service of a higher power.',
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
    id: classRowId(C, 99, 1),
    requirementGroups: {
      groups: [
        {
          id: classRowId(C, 99, 2),
          requirements: [{ id: classRowId(C, 99, 3), ability: ABILITY_CODE.WISDOM, min: 13 }]
        }
      ]
    },
    proficiencies: [
      {
        id: classRowId(C, 99, 4),
        grantKind: GRANT_KIND.PROFICIENCY_GRANT,
        proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
        level: SCALING_AMOUNT_KIND.FULL,
        selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
        scalingKind: SCALING.NONE,
        authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
        properties: ['LIGHT', 'MEDIUM'],
        category: 'ARMOR',
        order: 0
      }
    ]
  },

  startingEquipment: {
    id: classRowId(C, 98, 1),
    sets: []
  },

  spellcasting: {
    ability: ABILITY_CODE.WISDOM,
    maxSpellLevel: 9,
    attributes: [SPELLCASTING_ATTRIBUTE.PREPARES_SPELLS],
    charges: clericSlotCharge,
    spellLimits: clericSpellLimits
  },

  proficiencies: [
    // Light armor
    {
      id: classRowId(C, 2, 1),
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
    // Medium armor
    {
      id: classRowId(C, 2, 2),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      properties: ['MEDIUM'],
      category: 'ARMOR',
      order: 1
    },
    // Shields
    {
      id: classRowId(C, 2, 3),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      properties: ['SHIELD'],
      category: 'ARMOR',
      order: 2
    },
    // Simple weapons
    {
      id: classRowId(C, 2, 4),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      properties: ['SIMPLE'],
      category: 'WEAPON',
      order: 3
    },
    // Saving throws: WIS, CHA
    {
      id: classRowId(C, 2, 5),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SAVE_ABILITY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      abilities: [ABILITY_CODE.WISDOM, ABILITY_CODE.CHARISMA],
      order: 4
    },
    // Skills: choose 2 from History, Insight, Medicine, Persuasion, Religion
    {
      id: classRowId(C, 2, 6),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SKILL,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
      scalingKind: SCALING.NONE,
      count: 2,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      skillIds: [
        skillId('HISTORY'),
        skillId('INSIGHT'),
        skillId('MEDICINE'),
        skillId('PERSUASION'),
        skillId('RELIGION')
      ],
      order: 5
    }
  ],

  features: [
    {
      id: classRowId(C, 3, 1),
      label: 'Spellcasting',
      description: 'As a conduit for divine power, you can cast cleric spells.',
      availableAtLevel: 1,
      order: 0
    },
    {
      id: classRowId(C, 3, 2),
      label: 'Divine Domain',
      description: 'Choose one domain related to your deity. Your choice grants you domain spells and other features when you choose it at 1st level.',
      availableAtLevel: 1,
      order: 1
    },
    {
      id: classRowId(C, 3, 3),
      label: 'Channel Divinity',
      description: 'At 2nd level, you gain the ability to channel divine energy directly from your deity, using that energy to fuel magical effects. You start with two such effects: Turn Undead and an effect determined by your domain.',
      availableAtLevel: 2,
      order: 2
    },
    {
      id: classRowId(C, 3, 4),
      label: 'Divine Domain Feature',
      description: 'At 2nd level, you gain a Channel Divinity option from your domain.',
      availableAtLevel: 2,
      order: 3
    },
    {
      id: classRowId(C, 3, 5),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 4,
      order: 4
    },
    {
      id: classRowId(C, 3, 6),
      label: 'Destroy Undead',
      description: 'Starting at 5th level, when an undead fails its saving throw against your Turn Undead feature, the creature is instantly destroyed if its challenge rating is at or below a certain threshold.',
      availableAtLevel: 5,
      order: 5
    },
    {
      id: classRowId(C, 3, 7),
      label: 'Divine Domain Feature',
      description: 'At 6th level, you gain a feature from your Divine Domain.',
      availableAtLevel: 6,
      order: 6
    },
    {
      id: classRowId(C, 3, 8),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 8,
      order: 7
    },
    {
      id: classRowId(C, 3, 9),
      label: 'Divine Domain Feature',
      description: 'At 8th level, you gain a feature from your Divine Domain.',
      availableAtLevel: 8,
      order: 8
    },
    {
      id: classRowId(C, 3, 10),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 12,
      order: 9
    },
    {
      id: classRowId(C, 3, 11),
      label: 'Divine Intervention',
      description: 'Beginning at 10th level, you can call on your deity to intervene on your behalf when your need is great.',
      availableAtLevel: 10,
      order: 10
    },
    {
      id: classRowId(C, 3, 12),
      label: 'Divine Domain Feature',
      description: 'At 17th level, you gain a feature from your Divine Domain.',
      availableAtLevel: 17,
      order: 11
    },
    {
      id: classRowId(C, 3, 13),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 16,
      order: 12
    },
    {
      id: classRowId(C, 3, 14),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 19,
      order: 13
    }
  ]
}
