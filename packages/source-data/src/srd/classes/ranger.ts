import {
  ACTIVATION_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_DUPLICATE_POLICY,
  AUTHORING_SELECTION_KIND,
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
  PATH_CODE,
  PROFICIENCY_KIND,
  RANGE_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  SPELLCASTING_ATTRIBUTE,
  STARTING_EQUIPMENT_KIND,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  type ClassAuthored,
  type ClosedRuleKind,
  type EffectAuthored
} from '@artificer-toolkit/shared'
import { SRD_BASIC_ACTION_IDS } from '../basicActions.js'
import { standingGrantedActionsEffect } from '../closed-rule-effect.js'
import { CLASS_IDS } from '../ids.js'
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
  attackingItemPropertyRestriction,
  attacksPerAttackActionGrant,
  closedRuleEffect,
  duelingRestriction,
  gmRulingEffect,
  landsStrideRuling,
  selfActionEffect,
  twoWeaponFightingGrants
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

function equipmentId(index: number): string {
  const hex = index.toString(16).padStart(4, '0')
  return `00000000-0000-0000-0060-${hex}00000000`
}

const RA = 8 // Ranger class index

const abilityScoreImprovementDescription =
  "When you reach 4th level, and again at 8th, 12th, 16th, and 19th level, you can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1. As normal, you can't increase an ability score above 20 using this feature."

function selfClassRuleEffect(entry: number, ruleKind: ClosedRuleKind): EffectAuthored {
  return closedRuleEffect({
    id: classRowId(RA, 0x60, entry),
    ruleKind,
    invocation: {
      kind: 'PASSIVE',
      triggerCode: TRIGGER.ACTIVATED,
      range: { id: classRowId(RA, 0x69, entry), rangeKind: RANGE_KIND.SELF },
      targeting: { selectionKind: 'SELF' }
    }
  })
}

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
  {
    classLevel: 5,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 2 }
    ],
    learnedSpellsLimit: 4
  },
  {
    classLevel: 6,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 2 }
    ],
    learnedSpellsLimit: 4
  },
  {
    classLevel: 7,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 }
    ],
    learnedSpellsLimit: 5
  },
  {
    classLevel: 8,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 }
    ],
    learnedSpellsLimit: 5
  },
  {
    classLevel: 9,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 2 }
    ],
    learnedSpellsLimit: 6
  },
  {
    classLevel: 10,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 2 }
    ],
    learnedSpellsLimit: 6
  },
  {
    classLevel: 11,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 }
    ],
    learnedSpellsLimit: 7
  },
  {
    classLevel: 12,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 }
    ],
    learnedSpellsLimit: 7
  },
  {
    classLevel: 13,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 1 }
    ],
    learnedSpellsLimit: 8
  },
  {
    classLevel: 14,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 1 }
    ],
    learnedSpellsLimit: 8
  },
  {
    classLevel: 15,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 2 }
    ],
    learnedSpellsLimit: 9
  },
  {
    classLevel: 16,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 2 }
    ],
    learnedSpellsLimit: 9
  },
  {
    classLevel: 17,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 1 }
    ],
    learnedSpellsLimit: 10
  },
  {
    classLevel: 18,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 1 }
    ],
    learnedSpellsLimit: 10
  },
  {
    classLevel: 19,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 2 }
    ],
    learnedSpellsLimit: 11
  },
  {
    classLevel: 20,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 2 }
    ],
    learnedSpellsLimit: 11
  }
]

export const ranger: ClassAuthored = {
  id: CLASS_IDS.RANGER,
  label: 'Ranger',
  category: CLASS_CATEGORY.BASE,
  subclassSelectionLevel: 3,
  attributes: [CLASS_ATTRIBUTE.SPELLCASTER],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,

  hitpoint: {
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
    sets: [
      {
        id: classRowId(RA, 98, 2),
        order: 0,
        groups: [
          {
            id: classRowId(RA, 98, 3),
            order: 0,
            options: [
              {
                id: classRowId(RA, 98, 4),
                order: 0,
                items: [
                  {
                    id: classRowId(RA, 98, 5),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(43)],
                    quantity: 1
                  }
                ]
              },
              {
                id: classRowId(RA, 98, 6),
                order: 1,
                items: [
                  {
                    id: classRowId(RA, 98, 7),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(39)],
                    quantity: 1
                  }
                ]
              }
            ]
          },
          {
            id: classRowId(RA, 98, 8),
            order: 1,
            options: [
              {
                id: classRowId(RA, 98, 9),
                order: 0,
                items: [
                  {
                    id: classRowId(RA, 98, 10),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(28)],
                    quantity: 2
                  }
                ]
              },
              {
                id: classRowId(RA, 98, 11),
                order: 1,
                items: [
                  {
                    id: classRowId(RA, 98, 12),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
                    authoringModeKind: AUTHORING_MODE_KIND.ALL,
                    category: EQUIPMENT_CATEGORY_CODE.WEAPON,
                    properties: [EQUIPMENT_PROPERTY_CODE.SIMPLE, EQUIPMENT_PROPERTY_CODE.MELEE],
                    count: 2
                  }
                ]
              }
            ]
          },
          {
            id: classRowId(RA, 98, 13),
            order: 2,
            options: [
              {
                id: classRowId(RA, 98, 14),
                order: 0,
                items: [
                  {
                    id: classRowId(RA, 98, 15),
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
                id: classRowId(RA, 98, 16),
                order: 1,
                items: [
                  {
                    id: classRowId(RA, 98, 17),
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
            id: classRowId(RA, 98, 18),
            order: 3,
            options: [
              {
                id: classRowId(RA, 98, 19),
                order: 0,
                items: [
                  {
                    id: classRowId(RA, 98, 20),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(36)],
                    quantity: 1
                  },
                  {
                    id: classRowId(RA, 98, 21),
                    order: 1,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(104)],
                    quantity: 1
                  },
                  {
                    id: classRowId(RA, 98, 22),
                    order: 2,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(99)],
                    quantity: 20
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },

  spellcasting: {
    availableAtLevel: 2,
    order: 0,
    ability: ABILITY_CODE.WISDOM,
    maxSpellLevel: 5,
    attributes: [SPELLCASTING_ATTRIBUTE.LIMIT_KNOWN_SPELL_AMOUNT],
    details: classSpellcastingDetails(RA, [
      {
        label: 'Spellcasting',
        description:
          '<p>By the time you reach 2nd level, you have learned to use the magical essence of nature to cast spells, much as a druid does.</p>'
      },
      {
        label: 'Spell Slots',
        description:
          "<p>The Ranger table shows how many spell slots you have to cast your spells of 1st level and higher. To cast one of these spells, you must expend a slot of the spell's level or higher. You regain all expended spell slots when you finish a long rest.</p><p>For example, if you know the 1st-level spell <em>animal friendship</em> and have a 1st-level and a 2nd-level spell slot available, you can cast <em>animal friendship</em> using either slot.</p>"
      },
      {
        label: 'Spells Known of 1st Level and Higher',
        description:
          '<p>You know two 1st-level spells of your choice from the ranger spell list.</p><p>The Spells Known column of the Ranger table shows when you learn more ranger spells of your choice. Each of these spells must be of a level for which you have spell slots. For instance, when you reach 5th level in this class, you can learn one new spell of 1st or 2nd level.</p><p>Additionally, when you gain a level in this class, you can choose one of the ranger spells you know and replace it with another spell from the ranger spell list, which also must be of a level for which you have spell slots.</p>'
      },
      {
        label: 'Spellcasting Ability',
        description:
          '<p>Wisdom is your spellcasting ability for your ranger spells, since your magic draws on your attunement to nature. You use your Wisdom whenever a spell refers to your spellcasting ability. In addition, you use your Wisdom modifier when setting the saving throw DC for a ranger spell you cast and when making an attack roll with one.</p><p><strong>Spell save DC</strong> = 8 + your proficiency bonus + your Wisdom modifier</p><p><strong>Spell attack modifier</strong> = your proficiency bonus + your Wisdom modifier</p>'
      }
    ]),
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
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.ALL,
      category: 'SHIELD',
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
      selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
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
      description:
        'Beginning at 1st level, you have significant experience studying, tracking, hunting, and even talking to a certain type of enemy.\n\nChoose a type of favored enemy: aberrations, beasts, celestials, constructs, dragons, elementals, fey, fiends, giants, monstrosities, oozes, plants, or undead. Alternatively, you can select two races of humanoid (such as gnolls and orcs) as favored enemies.\n\nYou have advantage on Wisdom (Survival) checks to track your favored enemies, as well as on Intelligence checks to recall information about them.\n\nWhen you gain this feature, you also learn one language of your choice that is spoken by your favored enemies, if they speak one at all.\n\nYou choose one additional favored enemy, as well as an associated language, at 6th and 14th level. As you gain levels, your choices should reflect the types of monsters you have encountered on your adventures.',
      effects: [selfClassRuleEffect(1, CLOSED_RULE_KIND.CLASS_RANGER_FAVORED_ENEMY)],
      availableAtLevel: 1,
      order: 0
    },
    {
      id: classRowId(RA, 3, 2),
      label: 'Natural Explorer',
      description:
        "You are particularly familiar with one type of natural environment and are adept at traveling and surviving in such regions. Choose one type of favored terrain: arctic, coast, desert, forest, grassland, mountain, or swamp. When you make an Intelligence or Wisdom check related to your favored terrain, your proficiency bonus is doubled if you are using a skill that you're proficient in.\n\nWhile traveling for an hour or more in your favored terrain, you gain the following benefits:\n\n* Difficult terrain doesn't slow your group's travel.\n* Your group can't become lost except by magical means.\n* Even when you are engaged in another activity while traveling (such as foraging, navigating, or tracking), you remain alert to danger.\n* If you are traveling alone, you can move stealthily at a normal pace.\n* When you forage, you find twice as much food as you normally would.\n* While tracking other creatures, you also learn their exact number, their sizes, and how long ago they passed through the area.\n\nYou choose additional favored terrain types at 6th and 10th level.",
      availableAtLevel: 1,
      order: 1
    },
    {
      id: classRowId(RA, 3, 3),
      label: 'Fighting Style',
      description:
        "At 2nd level, you adopt a particular style of fighting as your specialty. Choose one of the following options. You can't take a Fighting Style option more than once, even if you later get to choose again.",
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
                valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
                domain: { attackDomain: 'RANGED' as const },
                modifierKind: MODIFIER_KIND.BONUS,
                scope: MODIFIER_SCOPE_KIND.GLOBAL,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                payload: { valueKind: 'FIXED' as const, amount: 2 },
                order: 0,
                // Ranged weapons only; a thrown melee weapon makes a ranged attack but is not one.
                restrictions: attackingItemPropertyRestriction(
                  (entry) => classRowId(RA, 0x7a, 0x10 + entry),
                  [{ constraint: 'INCLUDE', properties: ['RANGED'] }]
                )
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
                scope: MODIFIER_SCOPE_KIND.GLOBAL,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                payload: { valueKind: 'FIXED' as const, amount: 1 },
                order: 0,
                restrictions: {
                  id: classRowId(RA, 0x70, 1),
                  groups: [
                    {
                      id: classRowId(RA, 0x70, 2),
                      order: 0,
                      contexts: [
                        {
                          id: classRowId(RA, 0x70, 3),
                          order: 0,
                          subject: 'CHARACTER',
                          conditions: [
                            {
                              id: classRowId(RA, 0x70, 4),
                              order: 0,
                              kind: 'PREDICATE',
                              constraint: 'INCLUDE',
                              predicateCode: 'EQUIPMENT_EQUIPPED',
                              authoringModeKind: AUTHORING_MODE_KIND.ALL,
                              category: EQUIPMENT_CATEGORY_CODE.ARMOR
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              }
            ]
          },
          order: 1
        },
        {
          id: classRowId(RA, 4, 3),
          label: 'Dueling',
          description:
            'When you are wielding a melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.',
          grants: {
            modifiers: [
              {
                id: classRowId(RA, 4, 12),
                grantKind: GRANT_KIND.MODIFIER_GRANT,
                valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
                domain: { attackDomain: 'MELEE' as const },
                modifierKind: MODIFIER_KIND.BONUS,
                scope: MODIFIER_SCOPE_KIND.GLOBAL,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                payload: { valueKind: 'FIXED' as const, amount: 2 },
                order: 0,
                restrictions: duelingRestriction((entry) => classRowId(RA, 0x7a, 0x20 + entry))
              }
            ]
          },
          order: 2
        },
        {
          id: classRowId(RA, 4, 4),
          label: 'Two-Weapon Fighting',
          description:
            'When you engage in two-weapon fighting, you can add your ability modifier to the damage of the second attack.',
          grants: {
            modifiers: twoWeaponFightingGrants(
              (entry) => classRowId(RA, 4, 13 + entry),
              (entry) => classRowId(RA, 0x7a, 0x40 + entry)
            )
          },
          order: 3
        }
      ]
    },
    {
      id: classRowId(RA, 3, 4),
      label: 'Spellcasting',
      description:
        'By the time you reach 2nd level, you have learned to use the magical essence of nature to cast spells, much as a druid does.',
      availableAtLevel: 2,
      order: 3
    },
    {
      id: classRowId(RA, 3, 5),
      label: 'Ranger Archetype',
      description:
        'At 3rd level, you choose an archetype that you strive to emulate, such as the Hunter. Your choice grants you features at 3rd level and again at 7th, 11th, and 15th level.',
      attributes: [FEATURE_ATTRIBUTE.SUBCLASS_SELECTION],
      availableAtLevel: 3,
      order: 4
    },
    {
      id: classRowId(RA, 3, 6),
      label: 'Primeval Awareness',
      description:
        "Beginning at 3rd level, you can use your action and expend one ranger spell slot to focus your awareness on the region around you. For 1 minute per level of the spell slot you expend, you can sense whether the following types of creatures are present within 1 mile of you (or within up to 6 miles if you are in your favored terrain): aberrations, celestials, dragons, elementals, fey, fiends, and undead. This feature doesn't reveal the creatures' location or number.",
      availableAtLevel: 3,
      order: 5
    },
    {
      id: classRowId(RA, 3, 7),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 4,
      order: 6,
      optionChoices: [{ level: 4, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(RA, 5, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(40, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(RA, 3, 8),
      label: 'Extra Attack',
      description:
        'Beginning at 5th level, you can attack twice, instead of once, whenever you take the Attack action on your turn.',
      grants: {
        modifiers: [attacksPerAttackActionGrant(classRowId(RA, 0x6f, 1), 2)]
      },
      availableAtLevel: 5,
      order: 7
    },
    {
      id: classRowId(RA, 3, 9),
      label: 'Favored Enemy Improvement',
      description:
        'Beginning at 1st level, you have significant experience studying, tracking, hunting, and even talking to a certain type of enemy.\n\nChoose a type of favored enemy: aberrations, beasts, celestials, constructs, dragons, elementals, fey, fiends, giants, monstrosities, oozes, plants, or undead. Alternatively, you can select two races of humanoid (such as gnolls and orcs) as favored enemies.\n\nYou have advantage on Wisdom (Survival) checks to track your favored enemies, as well as on Intelligence checks to recall information about them.\n\nWhen you gain this feature, you also learn one language of your choice that is spoken by your favored enemies, if they speak one at all.\n\nYou choose one additional favored enemy, as well as an associated language, at 6th and 14th level. As you gain levels, your choices should reflect the types of monsters you have encountered on your adventures.',
      effects: [selfClassRuleEffect(9, CLOSED_RULE_KIND.CLASS_RANGER_FAVORED_ENEMY)],
      availableAtLevel: 6,
      order: 8
    },
    {
      id: classRowId(RA, 3, 10),
      label: 'Natural Explorer Improvement',
      description:
        "You are particularly familiar with one type of natural environment and are adept at traveling and surviving in such regions. Choose one type of favored terrain: arctic, coast, desert, forest, grassland, mountain, or swamp. When you make an Intelligence or Wisdom check related to your favored terrain, your proficiency bonus is doubled if you are using a skill that you're proficient in.\n\nWhile traveling for an hour or more in your favored terrain, you gain the following benefits:\n\n* Difficult terrain doesn't slow your group's travel.\n* Your group can't become lost except by magical means.\n* Even when you are engaged in another activity while traveling (such as foraging, navigating, or tracking), you remain alert to danger.\n* If you are traveling alone, you can move stealthily at a normal pace.\n* When you forage, you find twice as much food as you normally would.\n* While tracking other creatures, you also learn their exact number, their sizes, and how long ago they passed through the area.\n\nYou choose additional favored terrain types at 6th and 10th level.",
      availableAtLevel: 6,
      order: 9
    },
    {
      id: classRowId(RA, 3, 11),
      label: 'Ranger Archetype Feature',
      description:
        'At 3rd level, you choose an archetype that you strive to emulate, such as the Hunter. Your choice grants you features at 3rd level and again at 7th, 11th, and 15th level.',
      availableAtLevel: 7,
      order: 10
    },
    {
      id: classRowId(RA, 3, 12),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 8,
      order: 11,
      optionChoices: [{ level: 8, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(RA, 6, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(41, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(RA, 3, 22),
      label: "Land's Stride",
      description:
        'Starting at 8th level, moving through nonmagical difficult terrain costs you no extra movement. You can also pass through nonmagical plants without being slowed by them and without taking damage from them if they have thorns, spines, or a similar hazard. In addition, you have advantage on saving throws against plants that are magically created or manipulated to impede movement, such those created by the entangle spell.',
      effects: [
        gmRulingEffect({
          ids: {
            effect: classRowId(RA, 0x60, 23),
            range: classRowId(RA, 0x69, 23),
            path: classRowId(RA, 0xd0, 2),
            result: classRowId(RA, 0xd1, 2),
            outcome: classRowId(RA, 0xd2, 2)
          },
          label: "Land's Stride",
          instructions: landsStrideRuling,
          reasonCode: MANUAL_ADJUDICATION_REASON.EXTERNAL_WORLD_STATE
        })
      ],
      availableAtLevel: 8,
      order: 12
    },
    {
      id: classRowId(RA, 3, 13),
      label: 'Hide in Plain Sight',
      description:
        'Starting at 10th level, you can spend 1 minute creating camouflage for yourself. You must have access to fresh mud, dirt, plants, soot, and other naturally occurring materials with which to create your camouflage.\n\nOnce you are camouflaged in this way, you can try to hide by pressing yourself up against a solid surface, such as a tree or wall, that is at least as tall and wide as you are. You gain a +10 bonus to Dexterity (Stealth) checks as long as you remain there without moving or taking actions. Once you move or take an action or a reaction, you must camouflage yourself again to gain this benefit.',
      // The 1 minute of camouflage preparation is not modelled: the action applies the bonus at once.
      effects: [
        selfActionEffect({
          ids: {
            effect: classRowId(RA, 0x60, 13),
            range: classRowId(RA, 0x69, 13),
            path: classRowId(RA, 0x80, 13),
            result: classRowId(RA, 0x81, 13)
          },
          activation: ACTIVATION_CODE.ACTION,
          lifecycle: { endOnEvents: ['ON_MOVE', 'ON_TAKE_ACTION'] },
          outcome: {
            id: classRowId(RA, 0x82, 13),
            effectKind: EFFECT_KIND.APPLY_GRANT,
            grants: {
              modifiers: [
                {
                  id: classRowId(RA, 0x84, 13),
                  grantKind: GRANT_KIND.MODIFIER_GRANT,
                  valueDomainCode: VALUE_DOMAIN_CODE.SKILL_MODIFIER,
                  domain: { skillId: skillId('STEALTH') },
                  modifierKind: MODIFIER_KIND.BONUS,
                  scope: MODIFIER_SCOPE_KIND.GLOBAL,
                  selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                  payload: { valueKind: 'FIXED', amount: 10 },
                  order: 1
                }
              ]
            }
          }
        })
      ],
      availableAtLevel: 10,
      order: 13
    },
    {
      id: classRowId(RA, 3, 14),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 12,
      order: 14,
      optionChoices: [{ level: 12, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(RA, 7, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(42, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(RA, 3, 15),
      label: 'Ranger Archetype Feature',
      description:
        'At 3rd level, you choose an archetype that you strive to emulate, such as the Hunter. Your choice grants you features at 3rd level and again at 7th, 11th, and 15th level.',
      availableAtLevel: 11,
      order: 15
    },
    {
      id: classRowId(RA, 3, 16),
      label: 'Vanish',
      description:
        "Starting at 14th level, you can use the Hide action as a bonus action on your turn. Also, you can't be tracked by nonmagical means, unless you choose to leave a trail.",
      effects: [
        standingGrantedActionsEffect({
          id: classRowId(RA, 0x60, 16),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.ACTIVATED,
            range: { id: classRowId(RA, 0x69, 16), rangeKind: RANGE_KIND.SELF },
            targeting: { selectionKind: 'SELF' }
          },
          grantedActions: [
            {
              activation: ACTIVATION_CODE.BONUS_ACTION,
              actionDefinitionIds: [SRD_BASIC_ACTION_IDS.HIDE]
            }
          ]
        })
      ],
      availableAtLevel: 14,
      order: 16
    },
    {
      id: classRowId(RA, 3, 17),
      label: 'Ranger Archetype Feature',
      description:
        'At 3rd level, you choose an archetype that you strive to emulate, such as the Hunter. Your choice grants you features at 3rd level and again at 7th, 11th, and 15th level.',
      availableAtLevel: 15,
      order: 17
    },
    {
      id: classRowId(RA, 3, 18),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 16,
      order: 18,
      optionChoices: [{ level: 16, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(RA, 8, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(43, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(RA, 3, 19),
      label: 'Feral Senses',
      description:
        "At 18th level, you gain preternatural senses that help you fight creatures you can't see. When you attack a creature you can't see, your inability to see it doesn't impose disadvantage on your attack rolls against it.\n\nYou are also aware of the location of any invisible creature within 30 feet of you, provided that the creature isn't hidden from you and you aren't blinded or deafened.",
      availableAtLevel: 18,
      order: 19
    },
    {
      id: classRowId(RA, 3, 20),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 19,
      order: 20,
      optionChoices: [{ level: 19, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(RA, 9, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(44, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(RA, 3, 21),
      label: 'Foe Slayer',
      description:
        'At 20th level, you become an unparalleled hunter of your enemies. Once on each of your turns, you can add your Wisdom modifier to the attack roll or the damage roll of an attack you make against one of your favored enemies. You can choose to use this feature before or after the roll, but before any effects of the roll are applied.',
      effects: [
        closedRuleEffect({
          id: classRowId(RA, 0x60, 21),
          ruleKind: CLOSED_RULE_KIND.CLASS_RANGER_FOE_SLAYER,
          pathCode: PATH_CODE.ON_ATTACK,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
            range: { id: classRowId(RA, 0x69, 21), rangeKind: RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: TARGET_DISPOSITION_KIND.HOSTILE
            }
          }
        }),
        closedRuleEffect({
          id: classRowId(RA, 0x60, 0x83),
          ruleKind: CLOSED_RULE_KIND.CLASS_RANGER_FOE_SLAYER,
          pathCode: PATH_CODE.ON_ATTACK,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.RANGED_WEAPON_ATTACK,
            range: { id: classRowId(RA, 0x69, 0x83), rangeKind: RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: TARGET_DISPOSITION_KIND.HOSTILE
            }
          }
        }),
        closedRuleEffect({
          id: classRowId(RA, 0x60, 0x84),
          ruleKind: CLOSED_RULE_KIND.CLASS_RANGER_FOE_SLAYER,
          pathCode: PATH_CODE.ON_ATTACK,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.MELEE_SPELL_ATTACK,
            range: { id: classRowId(RA, 0x69, 0x84), rangeKind: RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: TARGET_DISPOSITION_KIND.HOSTILE
            }
          }
        }),
        closedRuleEffect({
          id: classRowId(RA, 0x60, 0x8d),
          ruleKind: CLOSED_RULE_KIND.CLASS_RANGER_FOE_SLAYER,
          pathCode: PATH_CODE.ON_ATTACK,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.RANGED_SPELL_ATTACK,
            range: { id: classRowId(RA, 0x69, 0x8d), rangeKind: RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: TARGET_DISPOSITION_KIND.HOSTILE
            }
          }
        }),
        closedRuleEffect({
          id: classRowId(RA, 0x60, 0x86),
          ruleKind: CLOSED_RULE_KIND.CLASS_RANGER_FOE_SLAYER,
          pathCode: PATH_CODE.ON_HIT,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
            range: { id: classRowId(RA, 0x69, 0x86), rangeKind: RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: TARGET_DISPOSITION_KIND.HOSTILE
            }
          }
        }),
        closedRuleEffect({
          id: classRowId(RA, 0x60, 0x87),
          ruleKind: CLOSED_RULE_KIND.CLASS_RANGER_FOE_SLAYER,
          pathCode: PATH_CODE.ON_HIT,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.RANGED_WEAPON_ATTACK,
            range: { id: classRowId(RA, 0x69, 0x87), rangeKind: RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: TARGET_DISPOSITION_KIND.HOSTILE
            }
          }
        }),
        closedRuleEffect({
          id: classRowId(RA, 0x60, 0x88),
          ruleKind: CLOSED_RULE_KIND.CLASS_RANGER_FOE_SLAYER,
          pathCode: PATH_CODE.ON_HIT,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.MELEE_SPELL_ATTACK,
            range: { id: classRowId(RA, 0x69, 0x88), rangeKind: RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: TARGET_DISPOSITION_KIND.HOSTILE
            }
          }
        }),
        closedRuleEffect({
          id: classRowId(RA, 0x60, 0x8e),
          ruleKind: CLOSED_RULE_KIND.CLASS_RANGER_FOE_SLAYER,
          pathCode: PATH_CODE.ON_HIT,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.RANGED_SPELL_ATTACK,
            range: { id: classRowId(RA, 0x69, 0x8e), rangeKind: RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: TARGET_DISPOSITION_KIND.HOSTILE
            }
          }
        })
      ],
      availableAtLevel: 20,
      order: 21
    }
  ]
}
