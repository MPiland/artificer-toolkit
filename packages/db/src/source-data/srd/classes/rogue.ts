import {
  ABILITY_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  CLASS_CATEGORY,
  GRANT_KIND,
  PROFICIENCY_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
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

const R = 9 // Rogue class index

export const rogue: ClassAuthored = {
  id: CLASS_IDS.ROGUE,
  label: 'Rogue',
  category: CLASS_CATEGORY.BASE,
  description: 'A scoundrel who uses stealth and trickery to overcome obstacles and enemies.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,

  hitpoint: {
    ability: ABILITY_CODE.CONSTITUTION,
    dieConfig: 'd8'
  },

  startingGold: {
    multiplier: 10,
    currencyId: goldCurrencyId,
    dieConfig: '4d4'
  },

  multiclass: {
    id: classRowId(R, 99, 1),
    requirementGroups: {
      groups: [
        {
          id: classRowId(R, 99, 2),
          requirements: [{ id: classRowId(R, 99, 3), ability: ABILITY_CODE.DEXTERITY, min: 13 }]
        }
      ]
    },
    proficiencies: [
      {
        id: classRowId(R, 99, 4),
        grantKind: GRANT_KIND.PROFICIENCY_GRANT,
        proficiencyKind: PROFICIENCY_KIND.EQUIPMENT,
        level: SCALING_AMOUNT_KIND.FULL,
        selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
        scalingKind: SCALING.NONE,
        authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
        equipmentIds: [],
        order: 0
      }
    ]
  },

  startingEquipment: {
    id: classRowId(R, 98, 1),
    sets: []
  },

  proficiencies: [
    // Light armor
    {
      id: classRowId(R, 2, 1),
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
      id: classRowId(R, 2, 2),
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
    // Saving throws: DEX, INT
    {
      id: classRowId(R, 2, 3),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SAVE_ABILITY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      abilities: [ABILITY_CODE.DEXTERITY, ABILITY_CODE.INTELLIGENCE],
      order: 2
    },
    // Skills: choose 4 from the rogue list
    {
      id: classRowId(R, 2, 4),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SKILL,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
      scalingKind: SCALING.NONE,
      count: 4,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      skillIds: [
        skillId('ACROBATICS'),
        skillId('ATHLETICS'),
        skillId('DECEPTION'),
        skillId('INSIGHT'),
        skillId('INTIMIDATION'),
        skillId('INVESTIGATION'),
        skillId('PERCEPTION'),
        skillId('PERFORMANCE'),
        skillId('PERSUASION'),
        skillId('SLEIGHT_OF_HAND'),
        skillId('STEALTH')
      ],
      order: 3
    }
  ],

  features: [
    {
      id: classRowId(R, 3, 1),
      label: 'Expertise',
      description: 'At 1st level, choose two of your skill proficiencies, or one of your skill proficiencies and your proficiency with thieves\' tools. Your proficiency bonus is doubled for any ability check you make that uses either of the chosen proficiencies.',
      availableAtLevel: 1,
      order: 0
    },
    {
      id: classRowId(R, 3, 2),
      label: 'Sneak Attack',
      description: 'Beginning at 1st level, you know how to strike subtly and exploit a foe\'s distraction. Once per turn, you can deal an extra 1d6 damage to one creature you hit with an attack if you have advantage on the attack roll.',
      availableAtLevel: 1,
      order: 1
    },
    {
      id: classRowId(R, 3, 3),
      label: 'Thieves\' Cant',
      description: 'During your rogue training you learned thieves\' cant, a secret mix of dialect, jargon, and code that allows you to hide messages in seemingly normal conversation.',
      availableAtLevel: 1,
      order: 2,
      grants: {
        proficiencies: [
          {
            id: classRowId(R, 3, 30),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.LANGUAGE,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            languageIds: [languageId('THIEVES_CANT')],
            order: 0
          }
        ]
      }
    },
    {
      id: classRowId(R, 3, 4),
      label: 'Cunning Action',
      description: 'Starting at 2nd level, your quick thinking and agility allow you to move and act quickly. You can take a bonus action on each of your turns in combat. This action can be used only to take the Dash, Disengage, or Hide action.',
      availableAtLevel: 2,
      order: 3
    },
    {
      id: classRowId(R, 3, 5),
      label: 'Roguish Archetype',
      description: 'At 3rd level, you choose an archetype that you emulate in the exercise of your rogue abilities.',
      availableAtLevel: 3,
      order: 4
    },
    {
      id: classRowId(R, 3, 6),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 4,
      order: 5
    },
    {
      id: classRowId(R, 3, 7),
      label: 'Uncanny Dodge',
      description: 'Starting at 5th level, when an attacker that you can see hits you with an attack, you can use your reaction to halve the attack\'s damage against you.',
      availableAtLevel: 5,
      order: 6
    },
    {
      id: classRowId(R, 3, 8),
      label: 'Expertise',
      description: 'At 6th level, choose two more of your skill proficiencies. Your proficiency bonus is doubled for any ability check you make that uses either of the chosen proficiencies.',
      availableAtLevel: 6,
      order: 7,
      grants: {
        proficiencies: [
          {
            id: classRowId(R, 3, 31),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.SKILL,
            level: SCALING_AMOUNT_KIND.DOUBLE,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            count: 2,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            skillIds: [
              skillId('ACROBATICS'),
              skillId('ATHLETICS'),
              skillId('DECEPTION'),
              skillId('INSIGHT'),
              skillId('INTIMIDATION'),
              skillId('INVESTIGATION'),
              skillId('PERCEPTION'),
              skillId('PERFORMANCE'),
              skillId('PERSUASION'),
              skillId('SLEIGHT_OF_HAND'),
              skillId('STEALTH')
            ],
            order: 0
          }
        ]
      }
    },
    {
      id: classRowId(R, 3, 9),
      label: 'Evasion',
      description: 'Beginning at 7th level, you can nimbly dodge out of the way of certain area effects, such as a red dragon\'s fiery breath or an Ice Storm spell.',
      availableAtLevel: 7,
      order: 8
    },
    {
      id: classRowId(R, 3, 10),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 8,
      order: 9
    },
    {
      id: classRowId(R, 3, 11),
      label: 'Roguish Archetype Feature',
      description: 'At 9th level, you gain a feature from your Roguish Archetype.',
      availableAtLevel: 9,
      order: 10
    },
    {
      id: classRowId(R, 3, 12),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 10,
      order: 11
    },
    {
      id: classRowId(R, 3, 13),
      label: 'Reliable Talent',
      description: 'By 11th level, you have refined your chosen skills until they approach perfection. Whenever you make an ability check that lets you add your proficiency bonus, you can treat a d20 roll of 9 or lower as a 10.',
      availableAtLevel: 11,
      order: 12
    },
    {
      id: classRowId(R, 3, 14),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 12,
      order: 13
    },
    {
      id: classRowId(R, 3, 15),
      label: 'Roguish Archetype Feature',
      description: 'At 13th level, you gain a feature from your Roguish Archetype.',
      availableAtLevel: 13,
      order: 14
    },
    {
      id: classRowId(R, 3, 16),
      label: 'Blindsense',
      description: 'Starting at 14th level, if you are able to hear, you are aware of the location of any hidden or invisible creature within 10 feet of you.',
      availableAtLevel: 14,
      order: 15
    },
    {
      id: classRowId(R, 3, 17),
      label: 'Slippery Mind',
      description: 'By 15th level, you have acquired greater mental strength. You gain proficiency in Wisdom saving throws.',
      availableAtLevel: 15,
      order: 16,
      grants: {
        proficiencies: [
          {
            id: classRowId(R, 3, 170),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.SAVE_ABILITY,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            abilities: [ABILITY_CODE.WISDOM],
            order: 0
          }
        ]
      }
    },
    {
      id: classRowId(R, 3, 18),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 16,
      order: 17
    },
    {
      id: classRowId(R, 3, 19),
      label: 'Roguish Archetype Feature',
      description: 'At 17th level, you gain a feature from your Roguish Archetype.',
      availableAtLevel: 17,
      order: 18
    },
    {
      id: classRowId(R, 3, 20),
      label: 'Elusive',
      description: 'Beginning at 18th level, you are so evasive that attackers rarely gain the upper hand against you. No attack roll has advantage against you while you aren\'t incapacitated.',
      availableAtLevel: 18,
      order: 19
    },
    {
      id: classRowId(R, 3, 21),
      label: 'Ability Score Improvement',
      description: 'You can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1 each.',
      availableAtLevel: 19,
      order: 20
    },
    {
      id: classRowId(R, 3, 22),
      label: 'Stroke of Luck',
      description: 'At 20th level, you have an uncanny knack for succeeding when you need to. If your attack misses a target within range, you can turn the miss into a hit. Alternatively, if you fail an ability check, you can treat the d20 roll as a 20.',
      availableAtLevel: 20,
      order: 21
    }
  ]
}
