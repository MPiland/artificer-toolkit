import {
  ACTIVATION_CODE,
  ABILITY_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_DUPLICATE_POLICY,
  AUTHORING_SELECTION_KIND,
  CLASS_ATTRIBUTE,
  CLASS_CATEGORY,
  CLOSED_RULE_KIND,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  FEATURE_ATTRIBUTE,
  GRANT_KIND,
  PROFICIENCY_KIND,
  RANGE_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  SPELLCASTING_ATTRIBUTE,
  STARTING_EQUIPMENT_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type ActivationCode,
  type ClassAuthored,
  type ClosedRuleKind,
  type EffectAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS } from '../ids.js'
import { classSpellcastingDetails } from './spellcasting-details.js'
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

const D = 4 // Druid class index
const abilityScoreImprovementDescription =
  "When you reach 4th level, and again at 8th, 12th, 16th, and 19th level, you can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1. As normal, you can't increase an ability score above 20 using this feature."

function selfClassRuleEffect(
  entry: number,
  ruleKind: ClosedRuleKind,
  activationCode?: Exclude<ActivationCode, 'FREE'>,
  resourceChargeId?: string
): EffectAuthored {
  const range = { id: classRowId(D, 0x69, entry), rangeKind: RANGE_KIND.SELF } as const
  return closedRuleEffect({
    id: classRowId(D, 0x60, entry),
    ruleKind,
    invocation: activationCode
      ? {
          kind: 'ACTION',
          triggerCode: TRIGGER.ACTIVATED,
          ...(resourceChargeId ? { resourceUse: { chargeId: resourceChargeId, cost: 1 } } : {}),
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
  {
    classLevel: 3,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 2 }
    ],
    cantripsLimit: 2
  },
  {
    classLevel: 4,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 }
    ],
    cantripsLimit: 3
  },
  {
    classLevel: 5,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 2 }
    ],
    cantripsLimit: 3
  },
  {
    classLevel: 6,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 }
    ],
    cantripsLimit: 3
  },
  {
    classLevel: 7,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 1 }
    ],
    cantripsLimit: 3
  },
  {
    classLevel: 8,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 2 }
    ],
    cantripsLimit: 3
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
    cantripsLimit: 3
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
    cantripsLimit: 4
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
    cantripsLimit: 4
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
    cantripsLimit: 4
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
    cantripsLimit: 4
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
    cantripsLimit: 4
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
    cantripsLimit: 4
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
    cantripsLimit: 4
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
    cantripsLimit: 4
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
    cantripsLimit: 4
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
    cantripsLimit: 4
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
    cantripsLimit: 4
  }
]

export const druid: ClassAuthored = {
  id: CLASS_IDS.DRUID,
  label: 'Druid',
  category: CLASS_CATEGORY.BASE,
  subclassSelectionLevel: 2,
  attributes: [CLASS_ATTRIBUTE.SPELLCASTER],
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
    }
  },

  startingEquipment: {
    id: classRowId(D, 98, 1),
    sets: [
      {
        id: classRowId(D, 98, 2),
        order: 0,
        groups: [
          {
            id: classRowId(D, 98, 3),
            order: 0,
            options: [
              {
                id: classRowId(D, 98, 4),
                order: 0,
                items: [
                  {
                    id: classRowId(D, 98, 5),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(50)],
                    quantity: 1
                  }
                ]
              },
              {
                id: classRowId(D, 98, 6),
                order: 1,
                items: [
                  {
                    id: classRowId(D, 98, 7),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
                    authoringModeKind: AUTHORING_MODE_KIND.ALL,
                    category: EQUIPMENT_CATEGORY_CODE.WEAPON,
                    properties: [EQUIPMENT_PROPERTY_CODE.SIMPLE],
                    count: 1
                  }
                ]
              }
            ]
          },
          {
            id: classRowId(D, 98, 8),
            order: 1,
            options: [
              {
                id: classRowId(D, 98, 9),
                order: 0,
                items: [
                  {
                    id: classRowId(D, 98, 10),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(27)],
                    quantity: 1
                  }
                ]
              },
              {
                id: classRowId(D, 98, 11),
                order: 1,
                items: [
                  {
                    id: classRowId(D, 98, 12),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
                    authoringModeKind: AUTHORING_MODE_KIND.ALL,
                    category: EQUIPMENT_CATEGORY_CODE.WEAPON,
                    properties: [EQUIPMENT_PROPERTY_CODE.SIMPLE, EQUIPMENT_PROPERTY_CODE.MELEE],
                    count: 1
                  }
                ]
              }
            ]
          },
          {
            id: classRowId(D, 98, 13),
            order: 2,
            options: [
              {
                id: classRowId(D, 98, 14),
                order: 0,
                items: [
                  {
                    id: classRowId(D, 98, 15),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(39)],
                    quantity: 1
                  },
                  {
                    id: classRowId(D, 98, 16),
                    order: 1,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(186)],
                    quantity: 1
                  },
                  {
                    id: classRowId(D, 98, 17),
                    order: 2,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [92, 93, 94, 95].map(equipmentId),
                    count: 1
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
    ability: ABILITY_CODE.WISDOM,
    maxSpellLevel: 9,
    attributes: [SPELLCASTING_ATTRIBUTE.PREPARES_SPELLS],
    prepareLimit: {
      methodKinds: ['SPELLCASTING_ABILITY', 'CLASS_LEVEL'],
      scaling: SCALING_AMOUNT_KIND.FULL
    },
    details: classSpellcastingDetails(D, [
      {
        label: 'Spellcasting',
        description:
          '<p>Drawing on the divine essence of nature itself, you can cast spells to shape that essence to your will.</p>'
      },
      {
        label: 'Cantrips',
        description:
          '<p>At 1st level, you know two cantrips of your choice from the druid spell list. You learn additional druid cantrips of your choice at higher levels, as shown in the Cantrips Known column of the Druid table.</p>'
      },
      {
        label: 'Preparing and Casting Spells',
        description:
          "<p>The Druid table shows how many spell slots you have to cast your spells of 1st level and higher. To cast one of these druid spells, you must expend a slot of the spell's level or higher. You regain all expended spell slots when you finish a long rest.</p><p>You prepare the list of druid spells that are available for you to cast, choosing from the druid spell list. When you do so, choose a number of druid spells equal to your Wisdom modifier + your druid level (minimum of one spell). The spells must be of a level for which you have spell slots.</p><p>For example, if you are a 3rd-level druid, you have four 1st-level and two 2nd-level spell slots. With a Wisdom of 16, your list of prepared spells can include six spells of 1st or 2nd level, in any combination. If you prepare the 1st-level spell <em>cure wounds</em>, you can cast it using a 1st-level or 2nd-level slot. Casting the spell doesn't remove it from your list of prepared spells.</p><p>You can also change your list of prepared spells when you finish a long rest. Preparing a new list of druid spells requires time spent in prayer and meditation: at least 1 minute per spell level for each spell on your list.</p>"
      },
      {
        label: 'Spellcasting Ability',
        description:
          '<p>Wisdom is your spellcasting ability for your druid spells, since your magic draws upon your devotion and attunement to nature. You use your Wisdom whenever a spell refers to your spellcasting ability. In addition, you use your Wisdom modifier when setting the saving throw DC for a druid spell you cast and when making an attack roll with one.</p><p><strong>Spell save DC</strong> = 8 + your proficiency bonus + your Wisdom modifier</p><p><strong>Spell attack modifier</strong> = your proficiency bonus + your Wisdom modifier</p>'
      },
      {
        label: 'Ritual Casting',
        description:
          '<p>You can cast a druid spell as a ritual if that spell has the ritual tag and you have the spell prepared.</p>'
      },
      {
        label: 'Spellcasting Focus',
        description:
          '<p>You can use a druidic focus (see "Equipment") as a spellcasting focus for your druid spells.</p>'
      }
    ]),
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
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.ALL,
      category: 'SHIELD',
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
      selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
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
      description:
        "You know Druidic, the secret language of druids. You can speak the language and use it to leave hidden messages. You and others who know this language automatically spot such a message. Others spot the message's presence with a successful DC 15 Wisdom (Perception) check but can't decipher it without magic.",
      availableAtLevel: 1,
      order: 0,
      effects: [
        closedRuleEffect({
          id: classRowId(D, 0x60, 1),
          ruleKind: CLOSED_RULE_KIND.CLASS_DRUID_DRUIDIC_MESSAGES,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.ACTIVATED,
            range: { id: classRowId(D, 0x69, 1), rangeKind: RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
              dispositionKind: 'ANY'
            }
          }
        })
      ],
      grants: {
        proficiencies: [
          {
            id: classRowId(D, 3, 16),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.LANGUAGE,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            languageIds: [languageId('DRUIDIC')],
            order: 0
          }
        ]
      }
    },
    {
      id: classRowId(D, 3, 2),
      label: 'Spellcasting',
      description:
        'Drawing on the divine essence of nature itself, you can cast spells to shape that essence to your will.',
      availableAtLevel: 1,
      order: 1
    },
    {
      id: classRowId(D, 3, 3),
      label: 'Wild Shape',
      attributes: [FEATURE_ATTRIBUTE.LIMITED_USE],
      description:
        "Starting at 2nd level, you can use your action to magically assume the shape of a beast that you have seen before. You can use this feature twice. You regain expended uses when you finish a short or long rest. Your druid level determines the beasts you can transform into, as shown in the Beast Shapes table. At 2nd level, for example, you can transform into any beast that has a challenge rating of 1/4 or lower that doesn't have a flying or swimming speed. You can stay in a beast shape for a number of hours equal to half your druid level (rounded down). You then revert to your normal form unless you expend another use of this feature. You can revert to your normal form earlier by using a bonus action on your turn. You automatically revert if you fall unconscious, drop to 0 hit points, or die. While you are transformed, the following rules apply: * Your game statistics are replaced by the statistics of the beast, but you retain your alignment, personality, and Intelligence, Wisdom, and Charisma scores. You also retain all of your skill and saving throw proficiencies, in addition to gaining those of the creature. If the creature has the same proficiency as you and the bonus in its stat block is higher than yours, use the creature's bonus instead of yours. If the creature has any legendary or lair actions, you can't use them. * When you transform, you assume the beast's hit points and Hit Dice. When you revert to your normal form, you return to the number of hit points you had before you transformed. However, if you revert as a result of dropping to 0 hit points, any excess damage carries over to your normal form. For example, if you take 10 damage in animal form and have only 1 hit point left, you revert and take 9 damage. As long as the excess damage doesn't reduce your normal form to 0 hit points, you aren't knocked unconscious. * You can't cast spells, and your ability to speak or take any action that requires hands is limited to the capabilities of your beast form. Transforming doesn't break your concentration on a spell you've already cast, however, or prevent you from taking actions that are part of a spell, such as call lightning, that you've already cast. * You retain the benefit of any features from your class, race, or other source and can use them if the new form is physically capable of doing so. However, you can't use any of your special senses, such as darkvision, unless your new form also has that sense. * You choose whether your equipment falls to the ground in your space, merges into your new form, or is worn by it. Worn equipment functions as normal, but the GM decides whether it is practical for the new form to wear a piece of equipment, based on the creature's shape and size. Your equipment doesn't change size or shape to match the new form, and any equipment that the new form can't wear must either fall to the ground or merge with it. Equipment that merges with the form has no effect until you leave the form.",
      availableAtLevel: 2,
      order: 2,
      charges: {
        id: classRowId(D, 0x66, 3),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: SCALING.NONE,
        resetKind: 'SHORT_REST',
        amount: 2
      },
      effects: [
        selfClassRuleEffect(
          3,
          CLOSED_RULE_KIND.CLASS_DRUID_WILD_SHAPE,
          ACTIVATION_CODE.ACTION,
          classRowId(D, 0x66, 3)
        )
      ]
    },
    {
      id: classRowId(D, 3, 4),
      label: 'Druid Circle',
      description:
        'At 2nd level, you choose to identify with a circle of druids, such as the Circle of the Land. Your choice grants you features at 2nd level and again at 6th, 10th, and 14th level.',
      attributes: [FEATURE_ATTRIBUTE.SUBCLASS_SELECTION],
      availableAtLevel: 2,
      order: 3
    },
    {
      id: classRowId(D, 3, 5),
      label: 'Ability Score Improvement',
      description: abilityScoreImprovementDescription,
      availableAtLevel: 4,
      order: 4,
      optionChoices: [{ level: 4, count: 1 }],
      options: abilityScoreImprovementOptions(
        (optionEntry) => classRowId(D, 5, optionEntry),
        abilityScoreImprovementDescription
      ),
      effects: [selfClassRuleEffect(5, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)]
    },
    {
      id: classRowId(D, 3, 6),
      label: 'Druid Circle Feature',
      description:
        'At 2nd level, you choose to identify with a circle of druids, such as the Circle of the Land. Your choice grants you features at 2nd level and again at 6th, 10th, and 14th level.',
      availableAtLevel: 6,
      order: 5
    },
    {
      id: classRowId(D, 3, 7),
      label: 'Ability Score Improvement',
      description: abilityScoreImprovementDescription,
      availableAtLevel: 8,
      order: 6,
      optionChoices: [{ level: 8, count: 1 }],
      options: abilityScoreImprovementOptions(
        (optionEntry) => classRowId(D, 7, optionEntry),
        abilityScoreImprovementDescription
      ),
      effects: [selfClassRuleEffect(7, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)]
    },
    {
      id: classRowId(D, 3, 8),
      label: 'Druid Circle Feature',
      description:
        'At 2nd level, you choose to identify with a circle of druids, such as the Circle of the Land. Your choice grants you features at 2nd level and again at 6th, 10th, and 14th level.',
      availableAtLevel: 10,
      order: 7
    },
    {
      id: classRowId(D, 3, 9),
      label: 'Ability Score Improvement',
      description: abilityScoreImprovementDescription,
      availableAtLevel: 12,
      order: 8,
      optionChoices: [{ level: 12, count: 1 }],
      options: abilityScoreImprovementOptions(
        (optionEntry) => classRowId(D, 9, optionEntry),
        abilityScoreImprovementDescription
      ),
      effects: [selfClassRuleEffect(9, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)]
    },
    {
      id: classRowId(D, 3, 10),
      label: 'Druid Circle Feature',
      description:
        'At 2nd level, you choose to identify with a circle of druids, such as the Circle of the Land. Your choice grants you features at 2nd level and again at 6th, 10th, and 14th level.',
      availableAtLevel: 14,
      order: 9
    },
    {
      id: classRowId(D, 3, 11),
      label: 'Ability Score Improvement',
      description: abilityScoreImprovementDescription,
      availableAtLevel: 16,
      order: 10,
      optionChoices: [{ level: 16, count: 1 }],
      options: abilityScoreImprovementOptions(
        (optionEntry) => classRowId(D, 11, optionEntry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(11, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(D, 3, 12),
      label: 'Timeless Body',
      description:
        'Starting at 18th level, the primal magic that you wield causes you to age more slowly. For every 10 years that pass, your body ages only 1 year.',
      availableAtLevel: 18,
      order: 11,
      effects: [selfClassRuleEffect(12, CLOSED_RULE_KIND.CLASS_DRUID_TIMELESS_BODY)]
    },
    {
      id: classRowId(D, 3, 13),
      label: 'Beast Spells',
      description:
        "Beginning at 18th level, you can cast many of your druid spells in any shape you assume using Wild Shape. You can perform the somatic and verbal components of a druid spell while in a beast shape, but you aren't able to provide material components.",
      availableAtLevel: 18,
      order: 12,
      effects: [selfClassRuleEffect(13, CLOSED_RULE_KIND.CLASS_DRUID_BEAST_SPELLS)]
    },
    {
      id: classRowId(D, 3, 14),
      label: 'Ability Score Improvement',
      description: abilityScoreImprovementDescription,
      availableAtLevel: 19,
      order: 13,
      optionChoices: [{ level: 19, count: 1 }],
      options: abilityScoreImprovementOptions(
        (optionEntry) => classRowId(D, 14, optionEntry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(14, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(D, 3, 15),
      label: 'Archdruid',
      description:
        "At 20th level, you can use your Wild Shape an unlimited number of times. Additionally, you can ignore the verbal and somatic components of your druid spells, as well as any material components that lack a cost and aren't consumed by a spell. You gain this benefit in both your normal shape and your beast shape from Wild Shape.",
      availableAtLevel: 20,
      order: 14,
      effects: [selfClassRuleEffect(15, CLOSED_RULE_KIND.CLASS_DRUID_ARCHDRUID)]
    }
  ]
}
