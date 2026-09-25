import {
  ACTIVATION_CODE,
  ABILITY_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_DUPLICATE_POLICY,
  AUTHORING_SELECTION_KIND,
  CLASS_CATEGORY,
  CLOSED_RULE_KIND,
  FEATURE_ATTRIBUTE,
  MEASUREMENT_UNIT_CODE,
  PATH_CODE,
  STARTING_EQUIPMENT_KIND,
  GRANT_KIND,
  PROFICIENCY_KIND,
  RANGE_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
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
  SRD_LANGUAGES,
  SRD_SKILLS,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from '../vocabulary.js'
import { abilityScoreImprovementOptions, closedRuleEffect } from './mechanics.js'

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

function equipmentId(index: number): string {
  const hex = index.toString(16).padStart(4, '0')
  return `00000000-0000-0000-0060-${hex}00000000`
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

const abilityScoreImprovementDescription =
  "When you reach 4th level, and again at 8th, 10th, 12th, 16th, and 19th level, you can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1. As normal, you can't increase an ability score above 20 using this feature."

function selfClassRuleEffect(
  entry: number,
  ruleKind: ClosedRuleKind,
  activationCode?: Exclude<ActivationCode, 'FREE'>
): EffectAuthored {
  const range = { id: classRowId(R, 0x69, entry), rangeKind: RANGE_KIND.SELF } as const
  return closedRuleEffect({
    id: classRowId(R, 0x60, entry),
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

export const rogue: ClassAuthored = {
  id: CLASS_IDS.ROGUE,
  label: 'Rogue',
  category: CLASS_CATEGORY.BASE,
  subclassSelectionLevel: 3,
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
        proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
        level: SCALING_AMOUNT_KIND.FULL,
        selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
        scalingKind: SCALING.NONE,
        authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
        properties: ['LIGHT'],
        category: 'ARMOR',
        order: 0
      },
      {
        id: classRowId(R, 99, 5),
        grantKind: GRANT_KIND.PROFICIENCY_GRANT,
        proficiencyKind: PROFICIENCY_KIND.SKILL,
        level: SCALING_AMOUNT_KIND.FULL,
        selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
        scalingKind: SCALING.NONE,
        count: 1,
        selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
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
        order: 1
      },
      {
        id: classRowId(R, 99, 6),
        grantKind: GRANT_KIND.PROFICIENCY_GRANT,
        proficiencyKind: PROFICIENCY_KIND.EQUIPMENT,
        level: SCALING_AMOUNT_KIND.FULL,
        selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
        scalingKind: SCALING.NONE,
        authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
        equipmentIds: [equipmentId(85)],
        order: 2
      }
    ]
  },

  startingEquipment: {
    id: classRowId(R, 98, 1),
    sets: [
      {
        id: classRowId(R, 98, 2),
        order: 0,
        groups: [
          {
            id: classRowId(R, 98, 3),
            order: 0,
            options: [
              {
                id: classRowId(R, 98, 4),
                order: 0,
                items: [
                  {
                    id: classRowId(R, 98, 5),
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
                id: classRowId(R, 98, 6),
                order: 1,
                items: [
                  {
                    id: classRowId(R, 98, 7),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(28)],
                    quantity: 1
                  }
                ]
              }
            ]
          },
          {
            id: classRowId(R, 98, 8),
            order: 1,
            options: [
              {
                id: classRowId(R, 98, 9),
                order: 0,
                items: [
                  {
                    id: classRowId(R, 98, 10),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(13)],
                    quantity: 1
                  },
                  {
                    id: classRowId(R, 98, 11),
                    order: 1,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(104)],
                    quantity: 1
                  },
                  {
                    id: classRowId(R, 98, 12),
                    order: 2,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(99)],
                    quantity: 1
                  }
                ]
              },
              {
                id: classRowId(R, 98, 13),
                order: 1,
                items: [
                  {
                    id: classRowId(R, 98, 14),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(28)],
                    quantity: 1
                  }
                ]
              }
            ]
          },
          {
            id: classRowId(R, 98, 15),
            order: 2,
            options: [
              {
                id: classRowId(R, 98, 16),
                order: 0,
                items: [
                  {
                    id: classRowId(R, 98, 17),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(182)],
                    quantity: 1
                  }
                ]
              },
              {
                id: classRowId(R, 98, 18),
                order: 1,
                items: [
                  {
                    id: classRowId(R, 98, 19),
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
                id: classRowId(R, 98, 20),
                order: 2,
                items: [
                  {
                    id: classRowId(R, 98, 21),
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
            id: classRowId(R, 98, 22),
            order: 3,
            options: [
              {
                id: classRowId(R, 98, 23),
                order: 0,
                items: [
                  {
                    id: classRowId(R, 98, 24),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(39)],
                    quantity: 1
                  },
                  {
                    id: classRowId(R, 98, 25),
                    order: 1,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(2)],
                    quantity: 2
                  },
                  {
                    id: classRowId(R, 98, 26),
                    order: 2,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(85)],
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
      selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
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
    },
    // Weapons: hand crossbows, longswords, rapiers, shortswords
    {
      id: classRowId(R, 2, 5),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      equipmentIds: [34, 22, 26, 28].map(equipmentId),
      order: 4
    },
    // Tools: thieves' tools
    {
      id: classRowId(R, 2, 6),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      equipmentIds: [equipmentId(85)],
      order: 5
    }
  ],

  features: [
    {
      id: classRowId(R, 3, 1),
      label: 'Expertise',
      description:
        "At 1st level, choose two of your skill proficiencies, or one of your skill proficiencies and your proficiency with thieves' tools. Your proficiency bonus is doubled for any ability check you make that uses either of the chosen proficiencies.",
      availableAtLevel: 1,
      grants: {
        proficiencies: [
          {
            id: classRowId(R, 3, 32),
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
      },
      order: 0
    },
    {
      id: classRowId(R, 3, 2),
      label: 'Sneak Attack',
      description:
        "Beginning at 1st level, you know how to strike subtly and exploit a foe's distraction. Once per turn, you can deal an extra 1d6 damage to one creature you hit with an attack if you have advantage on the attack roll. The attack must use a finesse or a ranged weapon.\n\nYou don't need advantage on the attack roll if another enemy of the target is within 5 feet of it, that enemy isn't incapacitated, and you don't have disadvantage on the attack roll.\n\nThe amount of the extra damage increases as you gain levels in this class, as shown in the Sneak Attack column of the Rogue table.",
      effects: [
        closedRuleEffect({
          id: classRowId(R, 0x60, 2),
          ruleKind: CLOSED_RULE_KIND.CLASS_ROGUE_SNEAK_ATTACK,
          pathCode: PATH_CODE.ON_HIT,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
            range: { id: classRowId(R, 0x69, 2), rangeKind: RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: TARGET_DISPOSITION_KIND.HOSTILE
            }
          }
        }),
        closedRuleEffect({
          id: classRowId(R, 0x60, 0x81),
          ruleKind: CLOSED_RULE_KIND.CLASS_ROGUE_SNEAK_ATTACK,
          pathCode: PATH_CODE.ON_HIT,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.RANGED_WEAPON_ATTACK,
            range: { id: classRowId(R, 0x69, 0x81), rangeKind: RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: TARGET_DISPOSITION_KIND.HOSTILE
            }
          }
        })
      ],
      availableAtLevel: 1,
      order: 1
    },
    {
      id: classRowId(R, 3, 3),
      label: "Thieves' Cant",
      description:
        "During your rogue training you learned thieves' cant, a secret mix of dialect, jargon, and code that allows you to hide messages in seemingly normal conversation. Only another creature that knows thieves' cant understands such messages. It takes four times longer to convey such a message than it does to speak the same idea plainly.\n\nIn addition, you understand a set of secret signs and symbols used to convey short, simple messages, such as whether an area is dangerous or the territory of a thieves' guild, whether loot is nearby, or whether the people in an area are easy marks or will provide a safe house for thieves on the run.",
      availableAtLevel: 1,
      order: 2,
      effects: [selfClassRuleEffect(3, CLOSED_RULE_KIND.CLASS_ROGUE_THIEVES_CANT)],
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
      description:
        'Starting at 2nd level, your quick thinking and agility allow you to move and act quickly. You can take a bonus action on each of your turns in combat. This action can be used only to take the Dash, Disengage, or Hide action.',
      effects: [
        selfClassRuleEffect(
          4,
          CLOSED_RULE_KIND.CLASS_ROGUE_CUNNING_ACTION,
          ACTIVATION_CODE.BONUS_ACTION
        )
      ],
      availableAtLevel: 2,
      order: 3
    },
    {
      id: classRowId(R, 3, 5),
      label: 'Roguish Archetype',
      description:
        'At 3rd level, you choose an archetype that you emulate in the exercise of your rogue abilities, such as Thief. Your archetype choice grants you features at 3rd level and then again at 9th, 13th, and 17th level.',
      attributes: [FEATURE_ATTRIBUTE.SUBCLASS_SELECTION],
      availableAtLevel: 3,
      order: 4
    },
    {
      id: classRowId(R, 3, 6),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 4,
      order: 5,
      optionChoices: [{ level: 4, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(R, 4, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(40, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(R, 3, 7),
      label: 'Uncanny Dodge',
      description:
        "Starting at 5th level, when an attacker that you can see hits you with an attack, you can use your reaction to halve the attack's damage against you.",
      effects: [
        closedRuleEffect({
          id: classRowId(R, 0x60, 7),
          ruleKind: CLOSED_RULE_KIND.CLASS_ROGUE_UNCANNY_DODGE,
          invocation: {
            kind: 'ACTION',
            triggerCode: TRIGGER.ACTIVATED,
            activation: { code: ACTIVATION_CODE.REACTION, amount: 1 },
            range: { id: classRowId(R, 0x69, 7), rangeKind: RANGE_KIND.SIGHT },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: TARGET_DISPOSITION_KIND.HOSTILE
            }
          }
        })
      ],
      availableAtLevel: 5,
      order: 6
    },
    {
      id: classRowId(R, 3, 8),
      label: 'Expertise',
      description:
        "At 6th level, you can choose two more of your proficiencies (in skills or with thieves' tools) to gain this benefit.",
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
            selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
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
      description:
        "Beginning at 7th level, you can nimbly dodge out of the way of certain area effects, such as a red dragon's fiery breath or an ice storm spell. When you are subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you instead take no damage if you succeed on the saving throw, and only half damage if you fail.",
      effects: [selfClassRuleEffect(9, CLOSED_RULE_KIND.CLASS_ROGUE_EVASION)],
      availableAtLevel: 7,
      order: 8
    },
    {
      id: classRowId(R, 3, 10),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 8,
      order: 9,
      optionChoices: [{ level: 8, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(R, 5, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(41, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(R, 3, 11),
      label: 'Roguish Archetype Feature',
      description:
        'At 3rd level, you choose an archetype that you emulate in the exercise of your rogue abilities, such as Thief. Your archetype choice grants you features at 3rd level and then again at 9th, 13th, and 17th level.',
      availableAtLevel: 9,
      order: 10
    },
    {
      id: classRowId(R, 3, 12),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 10,
      order: 11,
      optionChoices: [{ level: 10, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(R, 6, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(42, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(R, 3, 13),
      label: 'Reliable Talent',
      description:
        'By 11th level, you have refined your chosen skills until they approach perfection. Whenever you make an ability check that lets you add your proficiency bonus, you can treat a d20 roll of 9 or lower as a 10.',
      effects: [selfClassRuleEffect(13, CLOSED_RULE_KIND.CLASS_ROGUE_RELIABLE_TALENT)],
      availableAtLevel: 11,
      order: 12
    },
    {
      id: classRowId(R, 3, 14),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 12,
      order: 13,
      optionChoices: [{ level: 12, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(R, 7, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(43, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(R, 3, 15),
      label: 'Roguish Archetype Feature',
      description:
        'At 3rd level, you choose an archetype that you emulate in the exercise of your rogue abilities, such as Thief. Your archetype choice grants you features at 3rd level and then again at 9th, 13th, and 17th level.',
      availableAtLevel: 13,
      order: 14
    },
    {
      id: classRowId(R, 3, 16),
      label: 'Blindsense',
      description:
        'Starting at 14th level, if you are able to hear, you are aware of the location of any hidden or invisible creature within 10 feet of you.',
      effects: [
        closedRuleEffect({
          id: classRowId(R, 0x60, 16),
          ruleKind: CLOSED_RULE_KIND.CLASS_ROGUE_BLINDSENSE,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.ACTIVATED,
            range: {
              id: classRowId(R, 0x69, 16),
              rangeKind: RANGE_KIND.DISTANCE,
              amount: 10,
              unit: MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
              dispositionKind: TARGET_DISPOSITION_KIND.ANY
            }
          }
        })
      ],
      availableAtLevel: 14,
      order: 15
    },
    {
      id: classRowId(R, 3, 17),
      label: 'Slippery Mind',
      description:
        'By 15th level, you have acquired greater mental strength. You gain proficiency in Wisdom saving throws.',
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
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 16,
      order: 17,
      optionChoices: [{ level: 16, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(R, 8, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(44, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(R, 3, 19),
      label: 'Roguish Archetype Feature',
      description:
        'At 3rd level, you choose an archetype that you emulate in the exercise of your rogue abilities, such as Thief. Your archetype choice grants you features at 3rd level and then again at 9th, 13th, and 17th level.',
      availableAtLevel: 17,
      order: 18
    },
    {
      id: classRowId(R, 3, 20),
      label: 'Elusive',
      description:
        "Beginning at 18th level, you are so evasive that attackers rarely gain the upper hand against you. No attack roll has advantage against you while you aren't incapacitated.",
      effects: [selfClassRuleEffect(20, CLOSED_RULE_KIND.CLASS_ROGUE_ELUSIVE)],
      availableAtLevel: 18,
      order: 19
    },
    {
      id: classRowId(R, 3, 21),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 19,
      order: 20,
      optionChoices: [{ level: 19, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(R, 9, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(45, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(R, 3, 22),
      label: 'Stroke of Luck',
      description:
        "At 20th level, you have an uncanny knack for succeeding when you need to. If your attack misses a target within range, you can turn the miss into a hit. Alternatively, if you fail an ability check, you can treat the d20 roll as a 20.\n\nOnce you use this feature, you can't use it again until you finish a short or long rest.",
      effects: [
        closedRuleEffect({
          id: classRowId(R, 0x60, 22),
          ruleKind: CLOSED_RULE_KIND.CLASS_ROGUE_STROKE_OF_LUCK,
          pathCode: PATH_CODE.ON_MISS,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
            range: { id: classRowId(R, 0x69, 22), rangeKind: RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: TARGET_DISPOSITION_KIND.HOSTILE
            }
          }
        }),
        closedRuleEffect({
          id: classRowId(R, 0x60, 0x82),
          ruleKind: CLOSED_RULE_KIND.CLASS_ROGUE_STROKE_OF_LUCK,
          pathCode: PATH_CODE.ON_MISS,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.RANGED_WEAPON_ATTACK,
            range: { id: classRowId(R, 0x69, 0x82), rangeKind: RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: TARGET_DISPOSITION_KIND.HOSTILE
            }
          }
        }),
        closedRuleEffect({
          id: classRowId(R, 0x60, 0x83),
          ruleKind: CLOSED_RULE_KIND.CLASS_ROGUE_STROKE_OF_LUCK,
          pathCode: PATH_CODE.ON_MISS,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.SPELL_ATTACK,
            range: { id: classRowId(R, 0x69, 0x83), rangeKind: RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: TARGET_DISPOSITION_KIND.HOSTILE
            }
          }
        }),
        selfClassRuleEffect(0x84, CLOSED_RULE_KIND.CLASS_ROGUE_STROKE_OF_LUCK)
      ],
      availableAtLevel: 20,
      order: 21
    }
  ]
}
