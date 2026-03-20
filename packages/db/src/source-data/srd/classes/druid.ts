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

const D = 4 // Druid class index

// Druid spell slot charge — full caster, resets on long rest
const druidSlotCharge = {
  id: classRowId(D, 1, 1),
  limitKind: 'FIXED_AMOUNT' as const,
  scalingKind: SCALING.PER_LEVEL,
  resetKind: 'LONG_REST' as const,
  levels: [
    { id: classRowId(D, 1, 2), level: 1, amount: 2 },
    { id: classRowId(D, 1, 3), level: 2, amount: 3 },
    { id: classRowId(D, 1, 4), level: 3, amount: 4 },
    { id: classRowId(D, 1, 5), level: 4, amount: 4 },
    { id: classRowId(D, 1, 6), level: 5, amount: 4 },
    { id: classRowId(D, 1, 7), level: 6, amount: 4 },
    { id: classRowId(D, 1, 8), level: 7, amount: 4 },
    { id: classRowId(D, 1, 9), level: 8, amount: 4 },
    { id: classRowId(D, 1, 10), level: 9, amount: 4 },
    { id: classRowId(D, 1, 11), level: 10, amount: 5 },
    { id: classRowId(D, 1, 12), level: 11, amount: 5 },
    { id: classRowId(D, 1, 13), level: 12, amount: 5 },
    { id: classRowId(D, 1, 14), level: 13, amount: 5 },
    { id: classRowId(D, 1, 15), level: 14, amount: 5 },
    { id: classRowId(D, 1, 16), level: 15, amount: 5 },
    { id: classRowId(D, 1, 17), level: 16, amount: 5 },
    { id: classRowId(D, 1, 18), level: 17, amount: 5 },
    { id: classRowId(D, 1, 19), level: 18, amount: 5 },
    { id: classRowId(D, 1, 20), level: 19, amount: 5 },
    { id: classRowId(D, 1, 21), level: 20, amount: 5 }
  ]
}

const druidSpellLimits = [
  { classLevel: 1, slots: [{ spellLevel: 1, slotCount: 2 }], cantripsLimit: 2 },
  { classLevel: 2, slots: [{ spellLevel: 1, slotCount: 3 }], cantripsLimit: 2 },
  { classLevel: 3, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 2 }], cantripsLimit: 2 },
  { classLevel: 4, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }], cantripsLimit: 3 },
  { classLevel: 5, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 2 }], cantripsLimit: 3 },
  { classLevel: 6, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }], cantripsLimit: 3 },
  { classLevel: 7, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 1 }], cantripsLimit: 3 },
  { classLevel: 8, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 2 }], cantripsLimit: 3 },
  { classLevel: 9, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 1 }], cantripsLimit: 3 },
  { classLevel: 10, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }], cantripsLimit: 4 },
  { classLevel: 11, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }, { spellLevel: 6, slotCount: 1 }], cantripsLimit: 4 },
  { classLevel: 12, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }, { spellLevel: 6, slotCount: 1 }], cantripsLimit: 4 },
  { classLevel: 13, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }, { spellLevel: 6, slotCount: 1 }, { spellLevel: 7, slotCount: 1 }], cantripsLimit: 4 },
  { classLevel: 14, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }, { spellLevel: 6, slotCount: 1 }, { spellLevel: 7, slotCount: 1 }], cantripsLimit: 4 },
  { classLevel: 15, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }, { spellLevel: 6, slotCount: 1 }, { spellLevel: 7, slotCount: 1 }, { spellLevel: 8, slotCount: 1 }], cantripsLimit: 4 },
  { classLevel: 16, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }, { spellLevel: 6, slotCount: 1 }, { spellLevel: 7, slotCount: 1 }, { spellLevel: 8, slotCount: 1 }], cantripsLimit: 4 },
  { classLevel: 17, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }, { spellLevel: 6, slotCount: 1 }, { spellLevel: 7, slotCount: 1 }, { spellLevel: 8, slotCount: 1 }, { spellLevel: 9, slotCount: 1 }], cantripsLimit: 4 },
  { classLevel: 18, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 3 }, { spellLevel: 6, slotCount: 1 }, { spellLevel: 7, slotCount: 1 }, { spellLevel: 8, slotCount: 1 }, { spellLevel: 9, slotCount: 1 }], cantripsLimit: 4 },
  { classLevel: 19, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 3 }, { spellLevel: 6, slotCount: 2 }, { spellLevel: 7, slotCount: 1 }, { spellLevel: 8, slotCount: 1 }, { spellLevel: 9, slotCount: 1 }], cantripsLimit: 4 },
  { classLevel: 20, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 3 }, { spellLevel: 6, slotCount: 2 }, { spellLevel: 7, slotCount: 2 }, { spellLevel: 8, slotCount: 1 }, { spellLevel: 9, slotCount: 1 }], cantripsLimit: 4 }
]

export const druid: ClassAuthored = {
  id: CLASS_IDS.DRUID,
  label: 'Druid',
  category: CLASS_CATEGORY.BASE,
  attributes: [CLASS_ATTRIBUTE.SPELLCASTER],
  description: 'A priest of the Old Faith, wielding the powers of nature and adopting animal forms.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,

  hitpoint: {
    ability: ABILITY_CODE.CONSTITUTION,
    dieConfig: 'd8'
  },

  startingGold: {
    multiplier: 10,
    currencyId: goldCurrencyId,
    dieConfig: '2d4'
  },

  multiclass: {
    id: classRowId(D, 99, 1),
    requirementGroups: {
      groups: [
        {
          id: classRowId(D, 99, 2),
          requirements: [{ id: classRowId(D, 99, 3), ability: ABILITY_CODE.WISDOM, min: 13 }]
        }
      ]
    },
    proficiencies: []
  },

  startingEquipment: {
    id: classRowId(D, 98, 1),
    sets: []
  },

  spellcasting: {
    ability: ABILITY_CODE.WISDOM,
    maxSpellLevel: 9,
    attributes: [SPELLCASTING_ATTRIBUTE.PREPARES_SPELLS],
    charges: druidSlotCharge,
    spellLimits: druidSpellLimits
  },

  proficiencies: [
    // Light armor (no metal)
    {
      id: classRowId(D, 2, 1),
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
      id: classRowId(D, 2, 2),
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
      id: classRowId(D, 2, 3),
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
    // Saving throws: INT, WIS
    {
      id: classRowId(D, 2, 4),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SAVE_ABILITY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      abilities: [ABILITY_CODE.INTELLIGENCE, ABILITY_CODE.WISDOM],
      order: 3
    },
    // Skills: choose 2 from Animal Handling, Arcana, History, Insight, Medicine, Nature, Perception, Religion, Survival
    {
      id: classRowId(D, 2, 5),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SKILL,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
      scalingKind: SCALING.NONE,
      count: 2,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      skillIds: [
        skillId('ANIMAL_HANDLING'),
        skillId('ARCANA'),
        skillId('HISTORY'),
        skillId('INSIGHT'),
        skillId('MEDICINE'),
        skillId('NATURE'),
        skillId('PERCEPTION'),
        skillId('RELIGION'),
        skillId('SURVIVAL')
      ],
      order: 4
    }
  ],

  features: [
    {
      id: classRowId(D, 3, 1),
      label: 'Druidic',
      description: 'You know Druidic, the secret language of druids. You can speak the language and use it to leave hidden messages.',
      availableAtLevel: 1,
      order: 0
    },
    {
      id: classRowId(D, 3, 2),
      label: 'Spellcasting',
      description: 'Drawing on the divine essence of nature itself, you can cast spells to shape that essence to your will.',
      availableAtLevel: 1,
      order: 1
    },
    {
      id: classRowId(D, 3, 3),
      label: 'Wild Shape',
      description: 'Starting at 2nd level, you can use your action to magically assume the shape of a beast that you have seen before.',
      availableAtLevel: 2,
      order: 2
    },
    {
      id: classRowId(D, 3, 4),
      label: 'Druid Circle',
      description: 'At 2nd level, you choose to identify with a circle of druids.',
      availableAtLevel: 2,
      order: 3
    },
    {
      id: classRowId(D, 3, 5),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 4,
      order: 4
    },
    {
      id: classRowId(D, 3, 6),
      label: 'Druid Circle Feature',
      description: 'At 6th level, you gain a feature from your Druid Circle.',
      availableAtLevel: 6,
      order: 5
    },
    {
      id: classRowId(D, 3, 7),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 8,
      order: 6
    },
    {
      id: classRowId(D, 3, 8),
      label: 'Druid Circle Feature',
      description: 'At 10th level, you gain a feature from your Druid Circle.',
      availableAtLevel: 10,
      order: 7
    },
    {
      id: classRowId(D, 3, 9),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 12,
      order: 8
    },
    {
      id: classRowId(D, 3, 10),
      label: 'Druid Circle Feature',
      description: 'At 14th level, you gain a feature from your Druid Circle.',
      availableAtLevel: 14,
      order: 9
    },
    {
      id: classRowId(D, 3, 11),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 16,
      order: 10
    },
    {
      id: classRowId(D, 3, 12),
      label: 'Timeless Body',
      description: 'Starting at 18th level, the primal magic that you wield causes you to age more slowly. For every 10 years that pass, your body ages only 1 year.',
      availableAtLevel: 18,
      order: 11
    },
    {
      id: classRowId(D, 3, 13),
      label: 'Beast Spells',
      description: 'Beginning at 18th level, you can cast many of your druid spells in any shape you assume using Wild Shape. You can perform the somatic and verbal components of a druid spell while in a beast shape.',
      availableAtLevel: 18,
      order: 12
    },
    {
      id: classRowId(D, 3, 14),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 19,
      order: 13
    },
    {
      id: classRowId(D, 3, 15),
      label: 'Archdruid',
      description: 'At 20th level, you can use your Wild Shape an unlimited number of times.',
      availableAtLevel: 20,
      order: 14
    }
  ]
}

// ─── Circle of the Land Subclass ──────────────────────────────────────────────

export const land: ClassAuthored = {
  id: SUBCLASS_IDS.LAND,
  label: 'Circle of the Land',
  category: CLASS_CATEGORY.SUBCLASS,
  parentClassId: CLASS_IDS.DRUID,
  description: 'The Circle of the Land is made up of mystics and sages who safeguard ancient knowledge and rites through a vast oral tradition.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: classRowId(D, 11, 1),
      label: 'Bonus Cantrip',
      description: 'When you choose this circle at 2nd level, you learn one additional druid cantrip of your choice.',
      availableAtLevel: 2,
      order: 0
    },
    {
      id: classRowId(D, 11, 2),
      label: 'Natural Recovery',
      description: 'Starting at 2nd level, you can regain some of your magical energy during a short rest. Choose expended spell slots to recover with a combined level equal to or less than half your druid level, rounded up, and none of the slots can be 6th level or higher. You must finish a long rest before you can use this feature again.',
      availableAtLevel: 2,
      order: 1
    },
    {
      id: classRowId(D, 11, 3),
      label: 'Circle Spells',
      description: 'At 3rd, 5th, 7th, and 9th level, you gain access to circle spells connected to the land where you became a druid. Choose one land: arctic, coastal, desert, forest, grassland, mountain, or swamp. These spells are always prepared and do not count against the number of spells you can prepare each day.',
      availableAtLevel: 3,
      order: 2
    },
    {
      id: classRowId(D, 11, 4),
      label: 'Land\'s Stride',
      description: 'Starting at 6th level, moving through nonmagical difficult terrain costs you no extra movement. You can also pass through nonmagical plants without being slowed by them and without taking damage from them if they have thorns, spines, or a similar hazard. You also have advantage on saving throws against plants magically created or manipulated to impede movement.',
      availableAtLevel: 6,
      order: 3
    },
    {
      id: classRowId(D, 11, 5),
      label: 'Nature\'s Ward',
      description: 'At 10th level, you can\'t be charmed or frightened by elementals or fey, and you are immune to poison and disease.',
      availableAtLevel: 10,
      order: 4
    },
    {
      id: classRowId(D, 11, 6),
      label: 'Nature\'s Sanctuary',
      description: 'At 14th level, beasts and plant creatures become hesitant to attack you. When a beast or plant creature attacks you, it must make a Wisdom saving throw against your druid spell save DC. On a failed save, it must choose a different target or the attack automatically misses. On a successful save, the creature is immune to this effect for 24 hours.',
      availableAtLevel: 14,
      order: 5
    }
  ]
}
