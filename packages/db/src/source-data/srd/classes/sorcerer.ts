import {
  ABILITY_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  CLASS_ATTRIBUTE,
  CLASS_CATEGORY,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PROFICIENCY_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  SPELLCASTING_ATTRIBUTE,
  VALUE_DOMAIN_CODE,
  type ClassAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SUBCLASS_IDS } from '../ids.js'
import {
  SRD_CURRENCIES,
  SRD_LANGUAGES,
  SRD_SKILLS,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from '../vocabulary.js'

function skillId(code: string): string {
  const entry = SRD_SKILLS.find((s) => s.code === code)
  if (!entry) throw new Error(`SRD skill vocabulary entry for ${code} required.`)
  return entry.id
}

function languageId(code: string): string {
  const entry = SRD_LANGUAGES.find((l) => l.code === code)
  if (!entry) throw new Error(`SRD language vocabulary entry for ${code} required.`)
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
          description: 'When you cast a spell that forces other creatures to make a saving throw, you can protect some of those creatures from the spell\'s full force. To do so, you spend 1 sorcery point and choose a number of those creatures up to your Charisma modifier (minimum of one creature). A chosen creature automatically succeeds on its saving throw against the spell.',
          order: 0
        },
        {
          id: classRowId(S, 13, 2),
          label: 'Distant Spell',
          description: 'When you cast a spell that has a range of 5 feet or greater, you can spend 1 sorcery point to double the range of the spell. When you cast a spell that has a range of touch, you can spend 1 sorcery point to make the range of the spell 30 feet.',
          order: 1
        },
        {
          id: classRowId(S, 13, 3),
          label: 'Empowered Spell',
          description: 'When you roll damage for a spell, you can spend 1 sorcery point to reroll a number of the damage dice up to your Charisma modifier (minimum of one). You must use the new rolls. You can use Empowered Spell even if you have already used a different Metamagic option during the casting of the spell.',
          order: 2
        },
        {
          id: classRowId(S, 13, 4),
          label: 'Extended Spell',
          description: 'When you cast a spell that has a duration of 1 minute or longer, you can spend 1 sorcery point to double its duration, to a maximum duration of 24 hours.',
          order: 3
        },
        {
          id: classRowId(S, 13, 5),
          label: 'Heightened Spell',
          description: 'When you cast a spell that forces a creature to make a saving throw to resist its effects, you can spend 3 sorcery points to give one target of the spell disadvantage on its first saving throw made against the spell.',
          order: 4
        },
        {
          id: classRowId(S, 13, 6),
          label: 'Quickened Spell',
          description: 'When you cast a spell that has a casting time of 1 action, you can spend 2 sorcery points to change the casting time to 1 bonus action for this casting.',
          order: 5
        },
        {
          id: classRowId(S, 13, 7),
          label: 'Subtle Spell',
          description: 'When you cast a spell, you can spend 1 sorcery point to cast it without any somatic or verbal components.',
          order: 6
        },
        {
          id: classRowId(S, 13, 8),
          label: 'Twinned Spell',
          description: 'When you cast a spell that targets only one creature and doesn\'t have a range of self, you can spend a number of sorcery points equal to the spell\'s level to target a second creature in range with the same spell (1 sorcery point if the spell is a cantrip). To be eligible, a spell must be incapable of targeting more than one creature at the spell\'s current level.',
          order: 7
        }
      ]
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
