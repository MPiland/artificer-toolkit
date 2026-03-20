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

const S = 10 // Sorcerer class index

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
  { classLevel: 1, slots: [{ spellLevel: 1, slotCount: 2 }], learnedSpellsLimit: 2, cantripsLimit: 4 },
  { classLevel: 2, slots: [{ spellLevel: 1, slotCount: 3 }], learnedSpellsLimit: 3, cantripsLimit: 4 },
  { classLevel: 3, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 2 }], learnedSpellsLimit: 4, cantripsLimit: 4 },
  { classLevel: 4, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }], learnedSpellsLimit: 5, cantripsLimit: 5 },
  { classLevel: 5, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 2 }], learnedSpellsLimit: 6, cantripsLimit: 5 },
  { classLevel: 6, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }], learnedSpellsLimit: 7, cantripsLimit: 5 },
  { classLevel: 7, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 1 }], learnedSpellsLimit: 8, cantripsLimit: 5 },
  { classLevel: 8, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 2 }], learnedSpellsLimit: 9, cantripsLimit: 5 },
  { classLevel: 9, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 1 }], learnedSpellsLimit: 10, cantripsLimit: 5 },
  { classLevel: 10, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }], learnedSpellsLimit: 11, cantripsLimit: 6 },
  { classLevel: 11, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }, { spellLevel: 6, slotCount: 1 }], learnedSpellsLimit: 12, cantripsLimit: 6 },
  { classLevel: 12, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }, { spellLevel: 6, slotCount: 1 }], learnedSpellsLimit: 12, cantripsLimit: 6 },
  { classLevel: 13, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }, { spellLevel: 6, slotCount: 1 }, { spellLevel: 7, slotCount: 1 }], learnedSpellsLimit: 13, cantripsLimit: 6 },
  { classLevel: 14, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }, { spellLevel: 6, slotCount: 1 }, { spellLevel: 7, slotCount: 1 }], learnedSpellsLimit: 13, cantripsLimit: 6 },
  { classLevel: 15, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }, { spellLevel: 6, slotCount: 1 }, { spellLevel: 7, slotCount: 1 }, { spellLevel: 8, slotCount: 1 }], learnedSpellsLimit: 14, cantripsLimit: 6 },
  { classLevel: 16, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }, { spellLevel: 6, slotCount: 1 }, { spellLevel: 7, slotCount: 1 }, { spellLevel: 8, slotCount: 1 }], learnedSpellsLimit: 14, cantripsLimit: 6 },
  { classLevel: 17, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }, { spellLevel: 6, slotCount: 1 }, { spellLevel: 7, slotCount: 1 }, { spellLevel: 8, slotCount: 1 }, { spellLevel: 9, slotCount: 1 }], learnedSpellsLimit: 15, cantripsLimit: 6 },
  { classLevel: 18, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 3 }, { spellLevel: 6, slotCount: 1 }, { spellLevel: 7, slotCount: 1 }, { spellLevel: 8, slotCount: 1 }, { spellLevel: 9, slotCount: 1 }], learnedSpellsLimit: 15, cantripsLimit: 6 },
  { classLevel: 19, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 3 }, { spellLevel: 6, slotCount: 2 }, { spellLevel: 7, slotCount: 1 }, { spellLevel: 8, slotCount: 1 }, { spellLevel: 9, slotCount: 1 }], learnedSpellsLimit: 15, cantripsLimit: 6 },
  { classLevel: 20, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 3 }, { spellLevel: 6, slotCount: 2 }, { spellLevel: 7, slotCount: 2 }, { spellLevel: 8, slotCount: 1 }, { spellLevel: 9, slotCount: 1 }], learnedSpellsLimit: 15, cantripsLimit: 6 }
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
  attributes: [CLASS_ATTRIBUTE.SPELLCASTER, CLASS_ATTRIBUTE.RESOURCE],
  description: 'A spellcaster who draws on inherent magic from a gift or bloodline.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,

  hitpoint: {
    ability: ABILITY_CODE.CONSTITUTION,
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
    },
    proficiencies: []
  },

  startingEquipment: {
    id: classRowId(S, 98, 1),
    sets: []
  },

  spellcasting: {
    ability: ABILITY_CODE.CHARISMA,
    maxSpellLevel: 9,
    attributes: [SPELLCASTING_ATTRIBUTE.LIMIT_KNOWN_SPELL_AMOUNT],
    charges: sorcererSlotCharge,
    spellLimits: sorcererSpellLimits
  },

  proficiencies: [
    // Simple weapons
    {
      id: classRowId(S, 3, 1),
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
    id: classRowId(S, 5, 1),
    label: 'Sorcery Points',
    availableAtLevel: 2,
    charges: sorceryPointsCharge
  },

  features: [
    {
      id: classRowId(S, 4, 1),
      label: 'Spellcasting',
      description: 'An event in your past, or in the life of a parent or ancestor, left an indelible mark on you, infusing you with arcane magic.',
      availableAtLevel: 1,
      order: 0
    },
    {
      id: classRowId(S, 4, 2),
      label: 'Sorcerous Origin',
      description: 'Choose a sorcerous origin, which describes the source of your innate magical power.',
      availableAtLevel: 1,
      order: 1
    },
    {
      id: classRowId(S, 4, 3),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 4,
      order: 2
    },
    {
      id: classRowId(S, 4, 4),
      label: 'Font of Magic',
      description: 'At 2nd level, you tap into a deep wellspring of magic within yourself. This wellspring is represented by sorcery points, which allow you to create a variety of magical effects.',
      availableAtLevel: 2,
      order: 3
    },
    {
      id: classRowId(S, 4, 5),
      label: 'Metamagic',
      description: 'At 3rd level, you gain the ability to twist your spells to suit your needs. You gain two of the following Metamagic options of your choice.',
      availableAtLevel: 3,
      order: 4
    },
    {
      id: classRowId(S, 4, 6),
      label: 'Sorcerous Origin Feature',
      description: 'At 6th level, you gain a feature from your Sorcerous Origin.',
      availableAtLevel: 6,
      order: 5
    },
    {
      id: classRowId(S, 4, 7),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 8,
      order: 6
    },
    {
      id: classRowId(S, 4, 8),
      label: 'Metamagic',
      description: 'At 10th level, you learn an additional Metamagic option.',
      availableAtLevel: 10,
      order: 7
    },
    {
      id: classRowId(S, 4, 9),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 12,
      order: 8
    },
    {
      id: classRowId(S, 4, 10),
      label: 'Sorcerous Origin Feature',
      description: 'At 14th level, you gain a feature from your Sorcerous Origin.',
      availableAtLevel: 14,
      order: 9
    },
    {
      id: classRowId(S, 4, 11),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 16,
      order: 10
    },
    {
      id: classRowId(S, 4, 12),
      label: 'Metamagic',
      description: 'At 17th level, you learn an additional Metamagic option.',
      availableAtLevel: 17,
      order: 11
    },
    {
      id: classRowId(S, 4, 13),
      label: 'Sorcerous Origin Feature',
      description: 'At 18th level, you gain a feature from your Sorcerous Origin.',
      availableAtLevel: 18,
      order: 12
    },
    {
      id: classRowId(S, 4, 14),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 19,
      order: 13
    },
    {
      id: classRowId(S, 4, 15),
      label: 'Sorcerous Restoration',
      description: 'At 20th level, you regain 4 expended sorcery points whenever you finish a short rest.',
      availableAtLevel: 20,
      order: 14
    }
  ]
}

// ─── Draconic Bloodline Subclass ──────────────────────────────────────────────

export const draconicBloodline: ClassAuthored = {
  id: SUBCLASS_IDS.DRACONIC_BLOODLINE,
  label: 'Draconic Bloodline',
  category: CLASS_CATEGORY.SUBCLASS,
  parentClassId: CLASS_IDS.SORCERER,
  description: 'Your innate magic comes from draconic magic that was mingled with your blood or that of your ancestors.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: classRowId(S, 11, 1),
      label: 'Dragon Ancestor',
      description: 'At 1st level, you choose one type of dragon as your ancestor. The damage type associated with each dragon is used by features you gain later.',
      availableAtLevel: 1,
      order: 0
    },
    {
      id: classRowId(S, 11, 2),
      label: 'Draconic Resilience',
      description: 'As magic flows through your body, it causes physical traits of your dragon ancestors to emerge. At 1st level, your hit point maximum increases by 1 and increases by 1 again whenever you gain a level in this class. Additionally, parts of your skin are covered by a thin sheen of dragon-like scales. When you aren\'t wearing armor, your AC equals 13 + your Dexterity modifier.',
      availableAtLevel: 1,
      order: 1
    },
    {
      id: classRowId(S, 11, 3),
      label: 'Elemental Affinity',
      description: 'Starting at 6th level, when you cast a spell that deals damage of the type associated with your draconic ancestry, you can add your Charisma modifier to one damage roll of that spell.',
      availableAtLevel: 6,
      order: 2
    },
    {
      id: classRowId(S, 11, 4),
      label: 'Dragon Wings',
      description: 'At 14th level, you gain the ability to sprout a pair of dragon wings from your back, gaining a flying speed equal to your current speed. You can create these wings as a bonus action on your turn.',
      availableAtLevel: 14,
      order: 3
    },
    {
      id: classRowId(S, 11, 5),
      label: 'Draconic Presence',
      description: 'Beginning at 18th level, you can channel the dread presence of your dragon ancestor, causing those around you to become awestruck or frightened.',
      availableAtLevel: 18,
      order: 4
    }
  ]
}
