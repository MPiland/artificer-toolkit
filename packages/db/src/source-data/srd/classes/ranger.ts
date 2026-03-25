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

const RA = 8 // Ranger class index

// Ranger spell slot charge — half caster (starts L2), resets on long rest
const rangerSlotCharge = {
  id: classRowId(RA, 1, 1),
  limitKind: 'FIXED_AMOUNT' as const,
  scalingKind: SCALING.PER_LEVEL,
  resetKind: 'LONG_REST' as const,
  levels: [
    { id: classRowId(RA, 1, 2), level: 2, amount: 2 },
    { id: classRowId(RA, 1, 3), level: 3, amount: 3 },
    { id: classRowId(RA, 1, 4), level: 4, amount: 3 },
    { id: classRowId(RA, 1, 5), level: 5, amount: 4 },
    { id: classRowId(RA, 1, 6), level: 6, amount: 4 },
    { id: classRowId(RA, 1, 7), level: 7, amount: 4 },
    { id: classRowId(RA, 1, 8), level: 8, amount: 4 },
    { id: classRowId(RA, 1, 9), level: 9, amount: 4 },
    { id: classRowId(RA, 1, 10), level: 10, amount: 4 },
    { id: classRowId(RA, 1, 11), level: 11, amount: 5 },
    { id: classRowId(RA, 1, 12), level: 12, amount: 5 },
    { id: classRowId(RA, 1, 13), level: 13, amount: 5 },
    { id: classRowId(RA, 1, 14), level: 14, amount: 5 },
    { id: classRowId(RA, 1, 15), level: 15, amount: 5 },
    { id: classRowId(RA, 1, 16), level: 16, amount: 5 },
    { id: classRowId(RA, 1, 17), level: 17, amount: 5 },
    { id: classRowId(RA, 1, 18), level: 18, amount: 5 },
    { id: classRowId(RA, 1, 19), level: 19, amount: 5 },
    { id: classRowId(RA, 1, 20), level: 20, amount: 5 }
  ]
}

const rangerSpellLimits = [
  { classLevel: 2, slots: [{ spellLevel: 1, slotCount: 2 }], learnedSpellsLimit: 2 },
  { classLevel: 3, slots: [{ spellLevel: 1, slotCount: 3 }], learnedSpellsLimit: 3 },
  { classLevel: 4, slots: [{ spellLevel: 1, slotCount: 3 }], learnedSpellsLimit: 3 },
  { classLevel: 5, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 2 }], learnedSpellsLimit: 4 },
  { classLevel: 6, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 2 }], learnedSpellsLimit: 4 },
  { classLevel: 7, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }], learnedSpellsLimit: 5 },
  { classLevel: 8, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }], learnedSpellsLimit: 5 },
  { classLevel: 9, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 2 }], learnedSpellsLimit: 6 },
  { classLevel: 10, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 2 }], learnedSpellsLimit: 6 },
  { classLevel: 11, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }], learnedSpellsLimit: 7 },
  { classLevel: 12, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }], learnedSpellsLimit: 7 },
  { classLevel: 13, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 1 }], learnedSpellsLimit: 8 },
  { classLevel: 14, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 1 }], learnedSpellsLimit: 8 },
  { classLevel: 15, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 2 }], learnedSpellsLimit: 9 },
  { classLevel: 16, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 2 }], learnedSpellsLimit: 9 },
  { classLevel: 17, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 1 }], learnedSpellsLimit: 10 },
  { classLevel: 18, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 1 }], learnedSpellsLimit: 10 },
  { classLevel: 19, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }], learnedSpellsLimit: 11 },
  { classLevel: 20, slots: [{ spellLevel: 1, slotCount: 4 }, { spellLevel: 2, slotCount: 3 }, { spellLevel: 3, slotCount: 3 }, { spellLevel: 4, slotCount: 3 }, { spellLevel: 5, slotCount: 2 }], learnedSpellsLimit: 11 }
]

export const ranger: ClassAuthored = {
  id: CLASS_IDS.RANGER,
  label: 'Ranger',
  category: CLASS_CATEGORY.BASE,
  attributes: [CLASS_ATTRIBUTE.SPELLCASTER],
  description: 'A warrior who uses martial prowess and nature magic to combat threats on the edges of civilization.',
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
    id: classRowId(RA, 99, 1),
    requirementGroups: {
      groups: [
        {
          id: classRowId(RA, 99, 2),
          requirements: [
            { id: classRowId(RA, 99, 3), ability: ABILITY_CODE.DEXTERITY, min: 13 },
            { id: classRowId(RA, 99, 4), ability: ABILITY_CODE.WISDOM, min: 13 }
          ]
        }
      ]
    },
    proficiencies: [
      {
        id: classRowId(RA, 99, 5),
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
    id: classRowId(RA, 98, 1),
    sets: []
  },

  spellcasting: {
    ability: ABILITY_CODE.WISDOM,
    maxSpellLevel: 5,
    attributes: [SPELLCASTING_ATTRIBUTE.LIMIT_KNOWN_SPELL_AMOUNT],
    charges: rangerSlotCharge,
    spellLimits: rangerSpellLimits
  },

  proficiencies: [
    // Light armor
    {
      id: classRowId(RA, 2, 1),
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
      id: classRowId(RA, 2, 2),
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
      id: classRowId(RA, 2, 3),
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
      id: classRowId(RA, 2, 4),
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
      id: classRowId(RA, 2, 5),
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
    // Saving throws: STR, DEX
    {
      id: classRowId(RA, 2, 6),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SAVE_ABILITY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      abilities: [ABILITY_CODE.STRENGTH, ABILITY_CODE.DEXTERITY],
      order: 5
    },
    // Skills: choose 3 from Animal Handling, Athletics, Insight, Investigation, Nature, Perception, Stealth, Survival
    {
      id: classRowId(RA, 2, 7),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SKILL,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
      scalingKind: SCALING.NONE,
      count: 3,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      skillIds: [
        skillId('ANIMAL_HANDLING'),
        skillId('ATHLETICS'),
        skillId('INSIGHT'),
        skillId('INVESTIGATION'),
        skillId('NATURE'),
        skillId('PERCEPTION'),
        skillId('STEALTH'),
        skillId('SURVIVAL')
      ],
      order: 6
    }
  ],

  features: [
    {
      id: classRowId(RA, 3, 1),
      label: 'Favored Enemy',
      description: 'Beginning at 1st level, you have significant experience studying, tracking, hunting, and even talking to a certain type of enemy.',
      availableAtLevel: 1,
      order: 0
    },
    {
      id: classRowId(RA, 3, 2),
      label: 'Natural Explorer',
      description: 'You are a master of navigating the natural world, and you react with swift and decisive action when attacked. This grants you several benefits while you are traveling for an hour or more in your favored terrain.',
      availableAtLevel: 1,
      order: 1
    },
    {
      id: classRowId(RA, 3, 3),
      label: 'Fighting Style',
      description: 'At 2nd level, you adopt a particular style of fighting. Choose one of the following options.',
      availableAtLevel: 2,
      order: 2,
      optionChoices: [{ level: 2, count: 1 }],
      options: [
        {
          id: classRowId(RA, 4, 1),
          label: 'Archery',
          description: 'You gain a +2 bonus to attack rolls you make with ranged weapons.',
          grants: {
            modifiers: [
              {
                id: classRowId(RA, 4, 10),
                grantKind: GRANT_KIND.MODIFIER_GRANT,
                valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL_BONUS,
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
          id: classRowId(RA, 4, 2),
          label: 'Defense',
          description: 'While you are wearing armor, you gain a +1 bonus to AC.',
          grants: {
            modifiers: [
              {
                id: classRowId(RA, 4, 11),
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
          id: classRowId(RA, 4, 3),
          label: 'Dueling',
          description: 'When you are wielding a melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.',
          grants: {
            modifiers: [
              {
                id: classRowId(RA, 4, 12),
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
          id: classRowId(RA, 4, 4),
          label: 'Two-Weapon Fighting',
          description: 'When you engage in two-weapon fighting, you can add your ability modifier to the damage of the second attack.',
          order: 3
        }
      ]
    },
    {
      id: classRowId(RA, 3, 4),
      label: 'Spellcasting',
      description: 'By the time you reach 2nd level, you have learned to use the magical essence of nature to cast spells.',
      availableAtLevel: 2,
      order: 3
    },
    {
      id: classRowId(RA, 3, 5),
      label: 'Ranger Archetype',
      description: 'At 3rd level, you choose an archetype that you strive to emulate.',
      availableAtLevel: 3,
      order: 4
    },
    {
      id: classRowId(RA, 3, 6),
      label: 'Primeval Awareness',
      description: 'Beginning at 3rd level, you can use your action and expend one ranger spell slot to focus your awareness on the region around you.',
      availableAtLevel: 3,
      order: 5
    },
    {
      id: classRowId(RA, 3, 7),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 4,
      order: 6
    },
    {
      id: classRowId(RA, 3, 8),
      label: 'Extra Attack',
      description: 'Beginning at 5th level, you can attack twice, instead of once, whenever you take the Attack action on your turn.',
      availableAtLevel: 5,
      order: 7
    },
    {
      id: classRowId(RA, 3, 9),
      label: 'Favored Enemy Improvement',
      description: 'At 6th level, you choose one additional favored enemy, as well as an associated language.',
      availableAtLevel: 6,
      order: 8
    },
    {
      id: classRowId(RA, 3, 10),
      label: 'Natural Explorer Improvement',
      description: 'At 6th level, you choose one additional favored terrain.',
      availableAtLevel: 6,
      order: 9
    },
    {
      id: classRowId(RA, 3, 11),
      label: 'Ranger Archetype Feature',
      description: 'At 7th level, you gain a feature from your Ranger Archetype.',
      availableAtLevel: 7,
      order: 10
    },
    {
      id: classRowId(RA, 3, 12),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 8,
      order: 11
    },
    {
      id: classRowId(RA, 3, 13),
      label: 'Hide in Plain Sight',
      description: 'Starting at 10th level, you can spend 1 minute creating camouflage for yourself. You must have access to fresh mud, dirt, plants, soot, and other naturally occurring materials with which to create your camouflage.',
      availableAtLevel: 10,
      order: 12
    },
    {
      id: classRowId(RA, 3, 14),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 12,
      order: 13
    },
    {
      id: classRowId(RA, 3, 15),
      label: 'Ranger Archetype Feature',
      description: 'At 11th level, you gain a feature from your Ranger Archetype.',
      availableAtLevel: 11,
      order: 14
    },
    {
      id: classRowId(RA, 3, 16),
      label: 'Vanish',
      description: 'Starting at 14th level, you can use the Hide action as a bonus action on your turn. Also, you can\'t be tracked by nonmagical means, unless you choose to leave a trail.',
      availableAtLevel: 14,
      order: 15
    },
    {
      id: classRowId(RA, 3, 17),
      label: 'Ranger Archetype Feature',
      description: 'At 15th level, you gain a feature from your Ranger Archetype.',
      availableAtLevel: 15,
      order: 16
    },
    {
      id: classRowId(RA, 3, 18),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 16,
      order: 17
    },
    {
      id: classRowId(RA, 3, 19),
      label: 'Feral Senses',
      description: 'At 18th level, you gain preternatural senses that help you fight creatures you can\'t see. When you attack a creature you can\'t see, your inability to see it doesn\'t impose disadvantage on your attack rolls against it.',
      availableAtLevel: 18,
      order: 18
    },
    {
      id: classRowId(RA, 3, 20),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 19,
      order: 19
    },
    {
      id: classRowId(RA, 3, 21),
      label: 'Foe Slayer',
      description: 'At 20th level, you become an unparalleled hunter of your enemies. Once on each of your turns, you can add your Wisdom modifier to the attack roll or the damage roll of an attack you make against one of your favored enemies.',
      availableAtLevel: 20,
      order: 20
    }
  ]
}
