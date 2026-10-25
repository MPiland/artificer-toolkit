import {
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_DUPLICATE_POLICY,
  AUTHORING_SELECTION_KIND,
  CLASS_ATTRIBUTE,
  CLASS_CATEGORY,
  CLOSED_RULE_KIND,
  FEATURE_ATTRIBUTE,
  GRANT_KIND,
  PROFICIENCY_KIND,
  RANGE_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  SPELLCASTING_ATTRIBUTE,
  SPELL_GRANT_ATTRIBUTE,
  STARTING_EQUIPMENT_KIND,
  TRIGGER,
  type ClassAuthored,
  type ClosedRuleKind,
  type EffectAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS } from '../ids.js'
import { srdSpells } from '../spells/index.js'
import { classSpellcastingDetails } from './spellcasting-details.js'
import {
  SRD_CURRENCIES,
  SRD_SKILLS,
  SRD_SYSTEM_ID,
  SRD_USER_ID,
  ABILITY_CODE
} from '../vocabulary.js'
import { abilityScoreImprovementOptions, closedRuleEffect } from './mechanics.js'

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

const WZ = 12 // Wizard class index

const abilityScoreImprovementDescription =
  "When you reach 4th level, and again at 8th, 12th, 16th, and 19th level, you can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1. As normal, you can't increase an ability score above 20 using this feature."

function selfClassRuleEffect(entry: number, ruleKind: ClosedRuleKind): EffectAuthored {
  return closedRuleEffect({
    id: classRowId(WZ, 0x60, entry),
    ruleKind,
    invocation: {
      kind: 'PASSIVE',
      triggerCode: TRIGGER.ACTIVATED,
      range: { id: classRowId(WZ, 0x69, entry), rangeKind: RANGE_KIND.SELF },
      targeting: { selectionKind: 'SELF' }
    }
  })
}

function wizardSpellIdsAtLevel(level: number): string[] {
  return srdSpells
    .filter((spell) => spell.level === level && spell.classIds.includes(CLASS_IDS.WIZARD))
    .map((spell) => spell.id)
}

// Wizard spell slot charge — full caster, resets on long rest
const wizardSlotCharge = {
  id: classRowId(WZ, 1, 1),
  limitKind: 'FIXED_AMOUNT' as const,
  scalingKind: SCALING.PER_LEVEL,
  resetKind: 'LONG_REST' as const,
  levels: [
    { id: classRowId(WZ, 1, 2), level: 1, amount: 2 },
    { id: classRowId(WZ, 1, 3), level: 2, amount: 3 },
    { id: classRowId(WZ, 1, 4), level: 3, amount: 4 },
    { id: classRowId(WZ, 1, 5), level: 4, amount: 4 },
    { id: classRowId(WZ, 1, 6), level: 5, amount: 4 },
    { id: classRowId(WZ, 1, 7), level: 6, amount: 4 },
    { id: classRowId(WZ, 1, 8), level: 7, amount: 4 },
    { id: classRowId(WZ, 1, 9), level: 8, amount: 4 },
    { id: classRowId(WZ, 1, 10), level: 9, amount: 4 },
    { id: classRowId(WZ, 1, 11), level: 10, amount: 5 },
    { id: classRowId(WZ, 1, 12), level: 11, amount: 5 },
    { id: classRowId(WZ, 1, 13), level: 12, amount: 5 },
    { id: classRowId(WZ, 1, 14), level: 13, amount: 5 },
    { id: classRowId(WZ, 1, 15), level: 14, amount: 5 },
    { id: classRowId(WZ, 1, 16), level: 15, amount: 5 },
    { id: classRowId(WZ, 1, 17), level: 16, amount: 5 },
    { id: classRowId(WZ, 1, 18), level: 17, amount: 5 },
    { id: classRowId(WZ, 1, 19), level: 18, amount: 5 },
    { id: classRowId(WZ, 1, 20), level: 19, amount: 5 },
    { id: classRowId(WZ, 1, 21), level: 20, amount: 5 }
  ]
}

const wizardSpellLimits = [
  { classLevel: 1, slots: [{ spellLevel: 1, slotCount: 2 }], cantripsLimit: 3 },
  { classLevel: 2, slots: [{ spellLevel: 1, slotCount: 3 }], cantripsLimit: 3 },
  {
    classLevel: 3,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 2 }
    ],
    cantripsLimit: 3
  },
  {
    classLevel: 4,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 }
    ],
    cantripsLimit: 4
  },
  {
    classLevel: 5,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 2 }
    ],
    cantripsLimit: 4
  },
  {
    classLevel: 6,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 }
    ],
    cantripsLimit: 4
  },
  {
    classLevel: 7,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 1 }
    ],
    cantripsLimit: 4
  },
  {
    classLevel: 8,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 2 }
    ],
    cantripsLimit: 4
  },
  {
    classLevel: 9,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 1 }
    ],
    cantripsLimit: 4
  },
  {
    classLevel: 10,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 2 }
    ],
    cantripsLimit: 5
  },
  {
    classLevel: 11,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 2 },
      { spellLevel: 6, slotCount: 1 }
    ],
    cantripsLimit: 5
  },
  {
    classLevel: 12,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 2 },
      { spellLevel: 6, slotCount: 1 }
    ],
    cantripsLimit: 5
  },
  {
    classLevel: 13,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 2 },
      { spellLevel: 6, slotCount: 1 },
      { spellLevel: 7, slotCount: 1 }
    ],
    cantripsLimit: 5
  },
  {
    classLevel: 14,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 2 },
      { spellLevel: 6, slotCount: 1 },
      { spellLevel: 7, slotCount: 1 }
    ],
    cantripsLimit: 5
  },
  {
    classLevel: 15,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 2 },
      { spellLevel: 6, slotCount: 1 },
      { spellLevel: 7, slotCount: 1 },
      { spellLevel: 8, slotCount: 1 }
    ],
    cantripsLimit: 5
  },
  {
    classLevel: 16,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 2 },
      { spellLevel: 6, slotCount: 1 },
      { spellLevel: 7, slotCount: 1 },
      { spellLevel: 8, slotCount: 1 }
    ],
    cantripsLimit: 5
  },
  {
    classLevel: 17,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 2 },
      { spellLevel: 6, slotCount: 1 },
      { spellLevel: 7, slotCount: 1 },
      { spellLevel: 8, slotCount: 1 },
      { spellLevel: 9, slotCount: 1 }
    ],
    cantripsLimit: 5
  },
  {
    classLevel: 18,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 3 },
      { spellLevel: 6, slotCount: 1 },
      { spellLevel: 7, slotCount: 1 },
      { spellLevel: 8, slotCount: 1 },
      { spellLevel: 9, slotCount: 1 }
    ],
    cantripsLimit: 5
  },
  {
    classLevel: 19,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 3 },
      { spellLevel: 6, slotCount: 2 },
      { spellLevel: 7, slotCount: 1 },
      { spellLevel: 8, slotCount: 1 },
      { spellLevel: 9, slotCount: 1 }
    ],
    cantripsLimit: 5
  },
  {
    classLevel: 20,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 3 },
      { spellLevel: 6, slotCount: 2 },
      { spellLevel: 7, slotCount: 2 },
      { spellLevel: 8, slotCount: 1 },
      { spellLevel: 9, slotCount: 1 }
    ],
    cantripsLimit: 5
  }
].map((limit) => ({
  ...limit,
  learnedSpellsLimit: 4 + limit.classLevel * 2
}))

export const wizard: ClassAuthored = {
  id: CLASS_IDS.WIZARD,
  label: 'Wizard',
  category: CLASS_CATEGORY.BASE,
  subclassSelectionLevel: 2,
  attributes: [CLASS_ATTRIBUTE.SPELLCASTER],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,

  hitpoint: {
    dieConfig: 'd6'
  },

  startingGold: {
    multiplier: 10,
    currencyId: goldCurrencyId,
    dieConfig: '4d4'
  },

  multiclass: {
    id: classRowId(WZ, 99, 1),
    requirementGroups: {
      groups: [
        {
          id: classRowId(WZ, 99, 2),
          requirements: [{ id: classRowId(WZ, 99, 3), ability: ABILITY_CODE.INTELLIGENCE, min: 13 }]
        }
      ]
    }
  },

  startingEquipment: {
    id: classRowId(WZ, 98, 1),
    sets: [
      {
        id: classRowId(WZ, 98, 2),
        order: 0,
        groups: [
          {
            id: classRowId(WZ, 98, 3),
            order: 0,
            options: [
              {
                id: classRowId(WZ, 98, 4),
                order: 0,
                items: [
                  {
                    id: classRowId(WZ, 98, 5),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(8)],
                    quantity: 1
                  }
                ]
              },
              {
                id: classRowId(WZ, 98, 6),
                order: 1,
                items: [
                  {
                    id: classRowId(WZ, 98, 7),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(2)],
                    quantity: 1
                  }
                ]
              }
            ]
          },
          {
            id: classRowId(WZ, 98, 8),
            order: 1,
            options: [
              {
                id: classRowId(WZ, 98, 9),
                order: 0,
                items: [
                  {
                    id: classRowId(WZ, 98, 10),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(135)],
                    quantity: 1
                  }
                ]
              },
              {
                id: classRowId(WZ, 98, 11),
                order: 1,
                items: [
                  {
                    id: classRowId(WZ, 98, 12),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [87, 88, 89, 90, 91].map(equipmentId),
                    count: 1
                  }
                ]
              }
            ]
          },
          {
            id: classRowId(WZ, 98, 13),
            order: 2,
            options: [
              {
                id: classRowId(WZ, 98, 14),
                order: 0,
                items: [
                  {
                    id: classRowId(WZ, 98, 15),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(188)],
                    quantity: 1
                  }
                ]
              },
              {
                id: classRowId(WZ, 98, 16),
                order: 1,
                items: [
                  {
                    id: classRowId(WZ, 98, 17),
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
            id: classRowId(WZ, 98, 18),
            order: 3,
            options: [
              {
                id: classRowId(WZ, 98, 19),
                order: 0,
                items: [
                  {
                    id: classRowId(WZ, 98, 20),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(174)],
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

  spellcasting: {
    availableAtLevel: 1,
    order: 0,
    ability: ABILITY_CODE.INTELLIGENCE,
    maxSpellLevel: 9,
    attributes: [
      SPELLCASTING_ATTRIBUTE.PREPARES_SPELLS,
      SPELLCASTING_ATTRIBUTE.USES_SPELLBOOK,
      SPELLCASTING_ATTRIBUTE.RITUAL_CASTER
    ],
    prepareLimit: {
      methodKinds: ['SPELLCASTING_ABILITY', 'CLASS_LEVEL'],
      scaling: SCALING_AMOUNT_KIND.FULL
    },
    details: classSpellcastingDetails(WZ, [
      {
        label: 'Spellcasting',
        description:
          '<p>As a student of arcane magic, you have a spellbook containing spells that show the first glimmerings of your true power.</p>'
      },
      {
        label: 'Cantrips',
        description:
          '<p>At 1st level, you know three cantrips of your choice from the wizard spell list. You learn additional wizard cantrips of your choice at higher levels, as shown in the Cantrips Known column of the Wizard table.</p>'
      },
      {
        label: 'Spellbook',
        description:
          '<p>At 1st level, you have a spellbook containing six 1st-level wizard spells of your choice. Your spellbook is the repository of the wizard spells you know, except your cantrips, which are fixed in your mind.</p>'
      },
      {
        label: 'Preparing and Casting Spells',
        description:
          "<p>The Wizard table shows how many spell slots you have to cast your spells of 1st level and higher. To cast one of these spells, you must expend a slot of the spell's level or higher. You regain all expended spell slots when you finish a long rest.</p><p>You prepare the list of wizard spells that are available for you to cast. To do so, choose a number of wizard spells from your spellbook equal to your Intelligence modifier + your wizard level (minimum of one spell). The spells must be of a level for which you have spell slots.</p><p>For example, if you're a 3rd-level wizard, you have four 1st-level and two 2nd-level spell slots. With an Intelligence of 16, your list of prepared spells can include six spells of 1st or 2nd level, in any combination, chosen from your spellbook. If you prepare the 1st-level spell <em>magic missile</em>, you can cast it using a 1st-level or a 2nd-level slot. Casting the spell doesn't remove it from your list of prepared spells.</p><p>You can change your list of prepared spells when you finish a long rest. Preparing a new list of wizard spells requires time spent studying your spellbook and memorizing the incantations and gestures you must make to cast the spell: at least 1 minute per spell level for each spell on your list.</p>"
      },
      {
        label: 'Spellcasting Ability',
        description:
          '<p>Intelligence is your spellcasting ability for your wizard spells, since you learn your spells through dedicated study and memorization. You use your Intelligence whenever a spell refers to your spellcasting ability. In addition, you use your Intelligence modifier when setting the saving throw DC for a wizard spell you cast and when making an attack roll with one.</p><p><strong>Spell save DC</strong> = 8 + your proficiency bonus + your Intelligence modifier</p><p><strong>Spell attack modifier</strong> = your proficiency bonus + your Intelligence modifier</p>'
      },
      {
        label: 'Ritual Casting',
        description:
          "<p>You can cast a wizard spell as a ritual if that spell has the ritual tag and you have the spell in your spellbook. You don't need to have the spell prepared.</p>"
      },
      {
        label: 'Spellcasting Focus',
        description:
          '<p>You can use an arcane focus as a spellcasting focus for your wizard spells.</p>'
      },
      {
        label: 'Learning Spells of 1st Level and Higher',
        description:
          '<p>Each time you gain a wizard level, you can add two wizard spells of your choice to your spellbook for free. Each of these spells must be of a level for which you have spell slots, as shown on the Wizard table. On your adventures, you might find other spells that you can add to your spellbook (see the "Your Spellbook" sidebar).</p>'
      }
    ]),
    charges: wizardSlotCharge,
    spellLimits: wizardSpellLimits
  },

  proficiencies: [
    // Weapons: daggers, darts, slings, quarterstaffs, light crossbows
    {
      id: classRowId(WZ, 2, 1),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      equipmentIds: [2, 12, 14, 8, 11].map(equipmentId),
      order: 0
    },
    // Saving throws: INT, WIS
    {
      id: classRowId(WZ, 2, 2),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SAVE_ABILITY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      abilities: [ABILITY_CODE.INTELLIGENCE, ABILITY_CODE.WISDOM],
      order: 1
    },
    // Skills: choose 2 from Arcana, History, Insight, Investigation, Medicine, Religion
    {
      id: classRowId(WZ, 2, 3),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SKILL,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
      scalingKind: SCALING.NONE,
      count: 2,
      selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      skillIds: [
        skillId('ARCANA'),
        skillId('HISTORY'),
        skillId('INSIGHT'),
        skillId('INVESTIGATION'),
        skillId('MEDICINE'),
        skillId('RELIGION')
      ],
      order: 2
    }
  ],

  features: [
    {
      id: classRowId(WZ, 3, 1),
      label: 'Spellcasting',
      description:
        'As a student of arcane magic, you have a spellbook containing spells that show the first glimmerings of your true power.',
      availableAtLevel: 1,
      order: 0
    },
    {
      id: classRowId(WZ, 3, 2),
      label: 'Arcane Recovery',
      description:
        "You have learned to regain some of your magical energy by studying your spellbook. Once per day when you finish a short rest, you can choose expended spell slots to recover. The spell slots can have a combined level that is equal to or less than half your wizard level (rounded up), and none of the slots can be 6th level or higher.\n\nFor example, if you're a 4th-level wizard, you can recover up to two levels worth of spell slots. You can recover either a 2nd-level spell slot or two 1st-level spell slots.",
      effects: [selfClassRuleEffect(2, CLOSED_RULE_KIND.CLASS_WIZARD_ARCANE_RECOVERY)],
      availableAtLevel: 1,
      order: 1
    },
    {
      id: classRowId(WZ, 3, 3),
      label: 'Arcane Tradition',
      description:
        'When you reach 2nd level, you choose an arcane tradition, shaping your practice of magic through one of eight schools, such as Evocation.\n\nYour choice grants you features at 2nd level and again at 6th, 10th, and 14th level.',
      attributes: [FEATURE_ATTRIBUTE.SUBCLASS_SELECTION],
      availableAtLevel: 2,
      order: 2
    },
    {
      id: classRowId(WZ, 3, 4),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 4,
      order: 3,
      optionChoices: [{ level: 4, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(WZ, 4, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(40, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(WZ, 3, 5),
      label: 'Arcane Tradition Feature',
      description:
        'When you reach 2nd level, you choose an arcane tradition, shaping your practice of magic through one of eight schools, such as Evocation.\n\nYour choice grants you features at 2nd level and again at 6th, 10th, and 14th level.',
      availableAtLevel: 6,
      order: 4
    },
    {
      id: classRowId(WZ, 3, 6),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 8,
      order: 5,
      optionChoices: [{ level: 8, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(WZ, 5, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(41, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(WZ, 3, 7),
      label: 'Arcane Tradition Feature',
      description:
        'When you reach 2nd level, you choose an arcane tradition, shaping your practice of magic through one of eight schools, such as Evocation.\n\nYour choice grants you features at 2nd level and again at 6th, 10th, and 14th level.',
      availableAtLevel: 10,
      order: 6
    },
    {
      id: classRowId(WZ, 3, 8),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 12,
      order: 7,
      optionChoices: [{ level: 12, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(WZ, 6, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(42, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(WZ, 3, 9),
      label: 'Arcane Tradition Feature',
      description:
        'When you reach 2nd level, you choose an arcane tradition, shaping your practice of magic through one of eight schools, such as Evocation.\n\nYour choice grants you features at 2nd level and again at 6th, 10th, and 14th level.',
      availableAtLevel: 14,
      order: 8
    },
    {
      id: classRowId(WZ, 3, 10),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 16,
      order: 9,
      optionChoices: [{ level: 16, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(WZ, 7, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(43, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(WZ, 3, 11),
      label: 'Spell Mastery',
      description:
        'At 18th level, you have achieved such mastery over certain spells that you can cast them at will. Choose a 1st-level wizard spell and a 2nd-level wizard spell that are in your spellbook. You can cast those spells at their lowest level without expending a spell slot when you have them prepared. If you want to cast either spell at a higher level, you must expend a spell slot as normal.\n\nBy spending 8 hours in study, you can exchange one or both of the spells you chose for different spells of the same levels.',
      grants: {
        spells: [
          {
            id: classRowId(WZ, 0x50, 1),
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            count: 1,
            selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            spellIds: wizardSpellIdsAtLevel(1),
            attributes: [SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL, SPELL_GRANT_ATTRIBUTE.CAST_AT_LEVEL],
            castAtLevel: 1,
            order: 0
          },
          {
            id: classRowId(WZ, 0x50, 2),
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            count: 1,
            selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            spellIds: wizardSpellIdsAtLevel(2),
            attributes: [SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL, SPELL_GRANT_ATTRIBUTE.CAST_AT_LEVEL],
            castAtLevel: 2,
            order: 1
          }
        ]
      },
      availableAtLevel: 18,
      order: 10
    },
    {
      id: classRowId(WZ, 3, 12),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 19,
      order: 11,
      optionChoices: [{ level: 19, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(WZ, 8, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(44, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(WZ, 3, 13),
      label: 'Signature Spells',
      description:
        "When you reach 20th level, you gain mastery over two powerful spells and can cast them with little effort. Choose two 3rd-level wizard spells in your spellbook as your signature spells. You always have these spells prepared, they don't count against the number of spells you have prepared, and you can cast each of them once at 3rd level without expending a spell slot. When you do so, you can't do so again until you finish a short or long rest.\n\nIf you want to cast either spell at a higher level, you must expend a spell slot as normal.",
      grants: {
        spells: [
          {
            id: classRowId(WZ, 0x50, 3),
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            count: 2,
            selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            spellIds: wizardSpellIdsAtLevel(3),
            attributes: [
              SPELL_GRANT_ATTRIBUTE.PREPARED,
              SPELL_GRANT_ATTRIBUTE.LIMITED_USE,
              SPELL_GRANT_ATTRIBUTE.CAST_AT_LEVEL
            ],
            castAtLevel: 3,
            charges: {
              id: classRowId(WZ, 0x51, 3),
              limitKind: 'FIXED_AMOUNT',
              scalingKind: SCALING.NONE,
              resetKind: 'SHORT_REST',
              amount: 1
            },
            order: 0
          }
        ]
      },
      availableAtLevel: 20,
      order: 12
    }
  ]
}
