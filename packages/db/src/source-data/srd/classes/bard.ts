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

const BD = 2 // Bard class index

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
  { classLevel: 1, slots: [{ spellLevel: 1, slotCount: 2 }], learnedSpellsLimit: 4, cantripsLimit: 2 },
  { classLevel: 2, slots: [{ spellLevel: 1, slotCount: 3 }], learnedSpellsLimit: 5, cantripsLimit: 2 },
  { classLevel: 3, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 2 }], learnedSpellsLimit: 6, cantripsLimit: 2 },
  { classLevel: 4, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }], learnedSpellsLimit: 7, cantripsLimit: 3 },
  { classLevel: 5, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 2 }], learnedSpellsLimit: 8, cantripsLimit: 3 },
  { classLevel: 6, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }], learnedSpellsLimit: 9, cantripsLimit: 3 },
  { classLevel: 7, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 1 }], learnedSpellsLimit: 10, cantripsLimit: 3 },
  { classLevel: 8, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 2 }], learnedSpellsLimit: 11, cantripsLimit: 3 },
  { classLevel: 9, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 1 }], learnedSpellsLimit: 12, cantripsLimit: 3 },
  { classLevel: 10, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }], learnedSpellsLimit: 14, cantripsLimit: 4 },
  { classLevel: 11, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }, { spellLevel: 6, slotCount: 1 }], learnedSpellsLimit: 15, cantripsLimit: 4 },
  { classLevel: 12, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }, { spellLevel: 6, slotCount: 1 }], learnedSpellsLimit: 15, cantripsLimit: 4 },
  { classLevel: 13, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }, { spellLevel: 6, slotCount: 1 }, { spellLevel: 7, slotCount: 1 }], learnedSpellsLimit: 16, cantripsLimit: 4 },
  { classLevel: 14, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }, { spellLevel: 6, slotCount: 1 }, { spellLevel: 7, slotCount: 1 }], learnedSpellsLimit: 18, cantripsLimit: 4 },
  { classLevel: 15, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }, { spellLevel: 6, slotCount: 1 }, { spellLevel: 7, slotCount: 1 }, { spellLevel: 8, slotCount: 1 }], learnedSpellsLimit: 19, cantripsLimit: 4 },
  { classLevel: 16, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }, { spellLevel: 6, slotCount: 1 }, { spellLevel: 7, slotCount: 1 }, { spellLevel: 8, slotCount: 1 }], learnedSpellsLimit: 19, cantripsLimit: 4 },
  { classLevel: 17, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }, { spellLevel: 6, slotCount: 1 }, { spellLevel: 7, slotCount: 1 }, { spellLevel: 8, slotCount: 1 }, { spellLevel: 9, slotCount: 1 }], learnedSpellsLimit: 20, cantripsLimit: 4 },
  { classLevel: 18, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 3 }, { spellLevel: 6, slotCount: 1 }, { spellLevel: 7, slotCount: 1 }, { spellLevel: 8, slotCount: 1 }, { spellLevel: 9, slotCount: 1 }], learnedSpellsLimit: 22, cantripsLimit: 4 },
  { classLevel: 19, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 3 }, { spellLevel: 6, slotCount: 2 }, { spellLevel: 7, slotCount: 1 }, { spellLevel: 8, slotCount: 1 }, { spellLevel: 9, slotCount: 1 }], learnedSpellsLimit: 22, cantripsLimit: 4 },
  { classLevel: 20, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 3 }, { spellLevel: 6, slotCount: 2 }, { spellLevel: 7, slotCount: 2 }, { spellLevel: 8, slotCount: 1 }, { spellLevel: 9, slotCount: 1 }], learnedSpellsLimit: 22, cantripsLimit: 4 }
]

export const bard: ClassAuthored = {
  id: CLASS_IDS.BARD,
  label: 'Bard',
  category: CLASS_CATEGORY.BASE,
  attributes: [CLASS_ATTRIBUTE.SPELLCASTER],
  description: 'An inspiring magician whose power echoes the music of creation.',
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
      }
    ]
  },

  startingEquipment: {
    id: classRowId(BD, 98, 1),
    sets: []
  },

  spellcasting: {
    ability: ABILITY_CODE.CHARISMA,
    maxSpellLevel: 9,
    attributes: [SPELLCASTING_ATTRIBUTE.LIMIT_KNOWN_SPELL_AMOUNT],
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
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      skillIds: [
        skillId('ACROBATICS'), skillId('ANIMAL_HANDLING'), skillId('ARCANA'),
        skillId('ATHLETICS'), skillId('DECEPTION'), skillId('HISTORY'),
        skillId('INSIGHT'), skillId('INTIMIDATION'), skillId('INVESTIGATION'),
        skillId('MEDICINE'), skillId('NATURE'), skillId('PERCEPTION'),
        skillId('PERFORMANCE'), skillId('PERSUASION'), skillId('RELIGION'),
        skillId('SLEIGHT_OF_HAND'), skillId('STEALTH'), skillId('SURVIVAL')
      ],
      order: 3
    }
  ],

  features: [
    {
      id: classRowId(BD, 3, 1),
      label: 'Spellcasting',
      description: 'You have learned to untangle and reshape the fabric of reality in harmony with your wishes and music.',
      availableAtLevel: 1,
      order: 0
    },
    {
      id: classRowId(BD, 3, 2),
      label: 'Bardic Inspiration',
      description: 'You can inspire others through stirring words or music. To do so, you use a bonus action on your turn to choose one creature other than yourself within 60 feet of you who can hear you. That creature gains one Bardic Inspiration die, a d6.',
      availableAtLevel: 1,
      order: 1
    },
    {
      id: classRowId(BD, 3, 3),
      label: 'Jack of All Trades',
      description: 'Starting at 2nd level, you can add half your proficiency bonus, rounded down, to any ability check you make that doesn\'t already include your proficiency bonus.',
      availableAtLevel: 2,
      order: 2
    },
    {
      id: classRowId(BD, 3, 4),
      label: 'Song of Rest',
      description: 'Beginning at 2nd level, you can use soothing music or oration to help revitalize your wounded allies during a short rest.',
      availableAtLevel: 2,
      order: 3
    },
    {
      id: classRowId(BD, 3, 5),
      label: 'Bard College',
      description: 'At 3rd level, you delve into the advanced techniques of a bard college of your choice.',
      availableAtLevel: 3,
      order: 4
    },
    {
      id: classRowId(BD, 3, 6),
      label: 'Expertise',
      description: 'At 3rd level, choose two of your skill proficiencies. Your proficiency bonus is doubled for any ability check you make that uses either of the chosen proficiencies.',
      availableAtLevel: 3,
      order: 5
    },
    {
      id: classRowId(BD, 3, 7),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 4,
      order: 6
    },
    {
      id: classRowId(BD, 3, 8),
      label: 'Font of Inspiration',
      description: 'Beginning when you reach 5th level, you regain all of your expended uses of Bardic Inspiration when you finish a short or long rest.',
      availableAtLevel: 5,
      order: 7
    },
    {
      id: classRowId(BD, 3, 9),
      label: 'Countercharm',
      description: 'At 6th level, you gain the ability to use musical notes or words of power to disrupt mind-influencing effects.',
      availableAtLevel: 6,
      order: 8
    },
    {
      id: classRowId(BD, 3, 10),
      label: 'Bard College Feature',
      description: 'At 6th level, you gain a feature from your Bard College.',
      availableAtLevel: 6,
      order: 9
    },
    {
      id: classRowId(BD, 3, 11),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 8,
      order: 10
    },
    {
      id: classRowId(BD, 3, 12),
      label: 'Expertise',
      description: 'At 10th level, choose two more of your skill proficiencies. Your proficiency bonus is doubled for any ability check you make that uses either of the chosen proficiencies.',
      availableAtLevel: 10,
      order: 11
    },
    {
      id: classRowId(BD, 3, 13),
      label: 'Magical Secrets',
      description: 'By 10th level, you have plundered magical knowledge from a wide spectrum of disciplines. Choose two spells from any class, including this one.',
      availableAtLevel: 10,
      order: 12
    },
    {
      id: classRowId(BD, 3, 14),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 12,
      order: 13
    },
    {
      id: classRowId(BD, 3, 15),
      label: 'Bard College Feature',
      description: 'At 14th level, you gain a feature from your Bard College.',
      availableAtLevel: 14,
      order: 14
    },
    {
      id: classRowId(BD, 3, 16),
      label: 'Magical Secrets',
      description: 'At 14th level, you can choose two more spells from any class.',
      availableAtLevel: 14,
      order: 15
    },
    {
      id: classRowId(BD, 3, 17),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 16,
      order: 16
    },
    {
      id: classRowId(BD, 3, 18),
      label: 'Magical Secrets',
      description: 'At 18th level, you can choose two more spells from any class.',
      availableAtLevel: 18,
      order: 17
    },
    {
      id: classRowId(BD, 3, 19),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 19,
      order: 18
    },
    {
      id: classRowId(BD, 3, 20),
      label: 'Superior Inspiration',
      description: 'At 20th level, when you roll initiative and have no uses of Bardic Inspiration left, you regain one use.',
      availableAtLevel: 20,
      order: 19
    }
  ]
}

// ─── College of Lore Subclass ─────────────────────────────────────────────────

export const lore: ClassAuthored = {
  id: SUBCLASS_IDS.LORE,
  label: 'College of Lore',
  category: CLASS_CATEGORY.SUBCLASS,
  parentClassId: CLASS_IDS.BARD,
  description: 'Bards of the College of Lore know something about most things, collecting bits of knowledge from sources as diverse as scholarly tomes and peasant tales.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: classRowId(BD, 11, 1),
      label: 'Bonus Proficiencies',
      description: 'When you join the College of Lore at 3rd level, you gain proficiency with three skills of your choice.',
      availableAtLevel: 3,
      order: 0
    },
    {
      id: classRowId(BD, 11, 2),
      label: 'Cutting Words',
      description: 'Also at 3rd level, you learn how to use your wit to distract, confuse, and otherwise sap the confidence and competence of others.',
      availableAtLevel: 3,
      order: 1
    },
    {
      id: classRowId(BD, 11, 3),
      label: 'Additional Magical Secrets',
      description: 'At 6th level, you learn two spells of your choice from any class. A spell you choose must be of a level you can cast, as shown on the Bard table, or a cantrip.',
      availableAtLevel: 6,
      order: 2
    },
    {
      id: classRowId(BD, 11, 4),
      label: 'Peerless Skill',
      description: 'Starting at 14th level, when you make an ability check, you can expend one use of Bardic Inspiration. Roll a Bardic Inspiration die and add the number rolled to your ability check.',
      availableAtLevel: 14,
      order: 3
    }
  ]
}
