import {
  ABILITY_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  CLASS_CATEGORY,
  GRANT_KIND,
  PROFICIENCY_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  VALUE_DOMAIN_CODE,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
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

const B = 1 // Barbarian class index

// Rage resource charge — resets on long rest
const rageCharge = {
  id: classRowId(B, 1, 1),
  limitKind: 'FIXED_AMOUNT' as const,
  scalingKind: SCALING.PER_LEVEL,
  resetKind: 'LONG_REST' as const,
  levels: [
    { id: classRowId(B, 1, 2), level: 1, amount: 2 },
    { id: classRowId(B, 1, 3), level: 2, amount: 2 },
    { id: classRowId(B, 1, 4), level: 3, amount: 3 },
    { id: classRowId(B, 1, 5), level: 4, amount: 3 },
    { id: classRowId(B, 1, 6), level: 5, amount: 3 },
    { id: classRowId(B, 1, 7), level: 6, amount: 4 },
    { id: classRowId(B, 1, 8), level: 7, amount: 4 },
    { id: classRowId(B, 1, 9), level: 8, amount: 4 },
    { id: classRowId(B, 1, 10), level: 9, amount: 4 },
    { id: classRowId(B, 1, 11), level: 10, amount: 4 },
    { id: classRowId(B, 1, 12), level: 11, amount: 4 },
    { id: classRowId(B, 1, 13), level: 12, amount: 5 },
    { id: classRowId(B, 1, 14), level: 13, amount: 5 },
    { id: classRowId(B, 1, 15), level: 14, amount: 5 },
    { id: classRowId(B, 1, 16), level: 15, amount: 5 },
    { id: classRowId(B, 1, 17), level: 16, amount: 5 },
    { id: classRowId(B, 1, 18), level: 17, amount: 6 },
    { id: classRowId(B, 1, 19), level: 18, amount: 6 },
    { id: classRowId(B, 1, 20), level: 19, amount: 6 },
    { id: classRowId(B, 1, 21), level: 20, amount: 0 } // Unlimited at 20
  ]
}

export const barbarian: ClassAuthored = {
  id: CLASS_IDS.BARBARIAN,
  label: 'Barbarian',
  category: CLASS_CATEGORY.BASE,
  description: 'A fierce warrior of primitive background who can enter a battle rage.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,

  hitpoint: {
    ability: ABILITY_CODE.CONSTITUTION,
    dieConfig: 'd12'
  },

  startingGold: {
    multiplier: 10,
    currencyId: goldCurrencyId,
    dieConfig: '2d4'
  },

  multiclass: {
    id: classRowId(B, 99, 1),
    requirementGroups: {
      groups: [
        {
          id: classRowId(B, 99, 2),
          requirements: [{ id: classRowId(B, 99, 3), ability: ABILITY_CODE.STRENGTH, min: 13 }]
        }
      ]
    },
    proficiencies: [
      {
        id: classRowId(B, 99, 4),
        grantKind: GRANT_KIND.PROFICIENCY_GRANT,
        proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
        level: SCALING_AMOUNT_KIND.FULL,
        selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
        scalingKind: SCALING.NONE,
        authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
        properties: ['SHIELD'],
        category: 'ARMOR',
        order: 0
      }
    ]
  },

  startingEquipment: {
    id: classRowId(B, 98, 1),
    sets: []
  },

  proficiencies: [
    // Light armor
    {
      id: classRowId(B, 2, 1),
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
      id: classRowId(B, 2, 2),
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
      id: classRowId(B, 2, 3),
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
      id: classRowId(B, 2, 4),
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
    // Martial weapons
    {
      id: classRowId(B, 2, 5),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      properties: ['MARTIAL'],
      category: 'WEAPON',
      order: 4
    },
    // Saving throws: STR, CON
    {
      id: classRowId(B, 2, 6),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SAVE_ABILITY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      abilities: [ABILITY_CODE.STRENGTH, ABILITY_CODE.CONSTITUTION],
      order: 5
    },
    // Skills: choose 2 from Animal Handling, Athletics, Intimidation, Nature, Perception, Survival
    {
      id: classRowId(B, 2, 7),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SKILL,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
      scalingKind: SCALING.NONE,
      count: 2,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      skillIds: [
        skillId('ANIMAL_HANDLING'),
        skillId('ATHLETICS'),
        skillId('INTIMIDATION'),
        skillId('NATURE'),
        skillId('PERCEPTION'),
        skillId('SURVIVAL')
      ],
      order: 6
    }
  ],

  resources: {
    id: classRowId(B, 5, 1),
    label: 'Rage',
    availableAtLevel: 1,
    charges: rageCharge
  },

  features: [
    {
      id: classRowId(B, 3, 1),
      label: 'Rage',
      description: 'In battle, you fight with primal ferocity. On your turn, you can enter a rage as a bonus action. While raging, you have advantage on Strength checks and Strength saving throws, and you gain a bonus to damage rolls with melee weapons using Strength.',
      availableAtLevel: 1,
      order: 0
    },
    {
      id: classRowId(B, 3, 2),
      label: 'Unarmored Defense',
      description: 'While you are not wearing any armor, your Armor Class equals 10 + your Dexterity modifier + your Constitution modifier. You can use a shield and still gain this benefit.',
      availableAtLevel: 1,
      order: 1,
      grants: {
        modifiers: [
          {
            id: classRowId(B, 3, 3),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ARMOR_CLASS,
            domain: {},
            modifierKind: MODIFIER_KIND.ABILITY_MODIFIER_BONUS,
            scope: MODIFIER_SCOPE_KIND.SOURCE,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { ability: ABILITY_CODE.CONSTITUTION },
            order: 0
          }
        ]
      }
    },
    {
      id: classRowId(B, 3, 4),
      label: 'Reckless Attack',
      description: 'Starting at 2nd level, you can throw aside all concern for defense to attack with fierce desperation. When you make your first attack on your turn, you can decide to attack recklessly. Doing so gives you advantage on melee weapon attack rolls using Strength during this turn, but attack rolls against you have advantage until your next turn.',
      availableAtLevel: 2,
      order: 2
    },
    {
      id: classRowId(B, 3, 5),
      label: 'Danger Sense',
      description: 'At 2nd level, you gain an uncanny sense of when things nearby aren\'t as they should be, giving you an edge when you dodge away from danger. You have advantage on Dexterity saving throws against effects that you can see.',
      availableAtLevel: 2,
      order: 3
    },
    {
      id: classRowId(B, 3, 6),
      label: 'Primal Path',
      description: 'At 3rd level, you choose a path that shapes the nature of your rage.',
      availableAtLevel: 3,
      order: 4
    },
    {
      id: classRowId(B, 3, 7),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 4,
      order: 5
    },
    {
      id: classRowId(B, 3, 8),
      label: 'Extra Attack',
      description: 'Beginning at 5th level, you can attack twice, instead of once, whenever you take the Attack action on your turn.',
      availableAtLevel: 5,
      order: 6
    },
    {
      id: classRowId(B, 3, 9),
      label: 'Fast Movement',
      description: 'Starting at 5th level, your speed increases by 10 feet while you aren\'t wearing heavy armor.',
      availableAtLevel: 5,
      order: 7
    },
    {
      id: classRowId(B, 3, 10),
      label: 'Feral Instinct',
      description: 'By 7th level, your instincts are so honed that you have advantage on initiative rolls. Additionally, if you are surprised at the beginning of combat and aren\'t incapacitated, you can act normally on your first turn.',
      availableAtLevel: 7,
      order: 8
    },
    {
      id: classRowId(B, 3, 11),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 8,
      order: 9
    },
    {
      id: classRowId(B, 3, 12),
      label: 'Brutal Critical',
      description: 'Beginning at 9th level, you can roll one additional weapon damage die when determining the extra damage for a critical hit with a melee attack. This increases at 13th and 17th level.',
      availableAtLevel: 9,
      order: 10
    },
    {
      id: classRowId(B, 3, 13),
      label: 'Primal Path Feature',
      description: 'At 10th level, you gain a feature from your Primal Path.',
      availableAtLevel: 10,
      order: 11
    },
    {
      id: classRowId(B, 3, 14),
      label: 'Relentless Rage',
      description: 'Starting at 11th level, your rage can keep you fighting despite grievous wounds. If you drop to 0 hit points while you\'re raging and don\'t die outright, you can make a DC 10 Constitution saving throw.',
      availableAtLevel: 11,
      order: 12
    },
    {
      id: classRowId(B, 3, 15),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 12,
      order: 13
    },
    {
      id: classRowId(B, 3, 16),
      label: 'Primal Path Feature',
      description: 'At 14th level, you gain a feature from your Primal Path.',
      availableAtLevel: 14,
      order: 14
    },
    {
      id: classRowId(B, 3, 17),
      label: 'Persistent Rage',
      description: 'Beginning at 15th level, your rage is so fierce that it ends early only if you fall unconscious or if you choose to end it.',
      availableAtLevel: 15,
      order: 15
    },
    {
      id: classRowId(B, 3, 18),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 16,
      order: 16
    },
    {
      id: classRowId(B, 3, 19),
      label: 'Indomitable Might',
      description: 'Beginning at 18th level, if your total for a Strength check is less than your Strength score, you can use that score in place of the total.',
      availableAtLevel: 18,
      order: 17
    },
    {
      id: classRowId(B, 3, 20),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 19,
      order: 18
    },
    {
      id: classRowId(B, 3, 21),
      label: 'Primal Champion',
      description: 'At 20th level, you embody the power of the wilds. Your Strength and Constitution scores increase by 4 each. Your maximum for those scores is now 24.',
      availableAtLevel: 20,
      order: 19
    }
  ]
}
