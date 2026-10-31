import {
  SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS,
  ABILITY_CODE
} from '../vocabulary.js'
import {
  ACTIVATION_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_DUPLICATE_POLICY,
  AUTHORING_SELECTION_KIND,
  CLASS_ATTRIBUTE,
  CLASS_CATEGORY,
  CLOSED_RULE_KIND,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  EFFECT_KIND,
  FEATURE_ATTRIBUTE,
  GRANT_KIND,
  MANUAL_ADJUDICATION_REASON,
  MEASUREMENT_UNIT_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  PROFICIENCY_KIND,
  RANGE_KIND,
  SAVING_THROW_DC_METHOD,
  SCALING,
  SCALING_AMOUNT_KIND,
  SHAPE_KIND,
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
import { SRD_CURRENCIES, SRD_SKILLS, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'
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

const C = 3 // Cleric class index
const abilityScoreImprovementDescription =
  "When you reach 4th level, and again at 8th, 12th, 16th, and 19th level, you can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1. As normal, you can't increase an ability score above 20 using this feature."

function selfClassRuleEffect(
  entry: number,
  ruleKind: ClosedRuleKind,
  activationCode?: Exclude<ActivationCode, 'FREE'>
): EffectAuthored {
  const range = { id: classRowId(C, 0x69, entry), rangeKind: RANGE_KIND.SELF } as const
  return closedRuleEffect({
    id: classRowId(C, 0x60, entry),
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

const divineInterventionCharge = {
  id: classRowId(C, 0x66, 11),
  limitKind: 'FIXED_AMOUNT',
  scalingKind: SCALING.NONE,
  resetKind: 'LONG_REST',
  amount: 1
} as const

/**
 * Divine Intervention as authored data: an action that spends the feature's one long-rest use and
 * hands the percentile roll, the GM's choice and the 7-day lockout on success to the table.
 */
const divineInterventionEffect: EffectAuthored = {
  id: classRowId(C, 0x60, 11),
  order: 1,
  invocation: {
    kind: 'ACTION',
    triggerCode: TRIGGER.ACTIVATED,
    resourceUse: { chargeId: divineInterventionCharge.id, cost: 1 },
    activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
    range: { id: classRowId(C, 0x69, 11), rangeKind: RANGE_KIND.SELF },
    targeting: { selectionKind: 'SELF' }
  },
  paths: [
    {
      id: classRowId(C, 0x80, 11),
      order: 1,
      pathCode: PATH_CODE.ON_USE,
      groupType: PATH_GROUP_TYPE.SINGLE,
      originKind: 'SOURCE',
      selectionKind: 'FIXED',
      resultBlock: {
        id: classRowId(C, 0x81, 11),
        resultKind: 'SINGLE',
        outcomes: [
          {
            id: classRowId(C, 0x6c, 11),
            effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
            label: 'Divine Intervention',
            reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
            instructions:
              'Describe the assistance you seek and roll percentile dice; at 20th level the call succeeds without a roll. On a roll equal to or lower than your cleric level, your deity intervenes: the GM chooses the nature of the intervention, and the effect of any cleric spell or cleric domain spell would be appropriate. If your deity intervenes, you cannot use this feature again for 7 days, even after a long rest.'
          }
        ]
      }
    }
  ]
}

// Cleric spell slot charge — resets on long rest (full caster)
const clericSlotCharge = {
  id: classRowId(C, 1, 1),
  limitKind: 'FIXED_AMOUNT' as const,
  scalingKind: SCALING.PER_LEVEL,
  resetKind: 'LONG_REST' as const,
  levels: [
    { id: classRowId(C, 1, 2), level: 1, amount: 2 },
    { id: classRowId(C, 1, 3), level: 2, amount: 3 },
    { id: classRowId(C, 1, 4), level: 3, amount: 4 },
    { id: classRowId(C, 1, 5), level: 4, amount: 4 },
    { id: classRowId(C, 1, 6), level: 5, amount: 4 },
    { id: classRowId(C, 1, 7), level: 6, amount: 4 },
    { id: classRowId(C, 1, 8), level: 7, amount: 4 },
    { id: classRowId(C, 1, 9), level: 8, amount: 4 },
    { id: classRowId(C, 1, 10), level: 9, amount: 4 },
    { id: classRowId(C, 1, 11), level: 10, amount: 5 },
    { id: classRowId(C, 1, 12), level: 11, amount: 5 },
    { id: classRowId(C, 1, 13), level: 12, amount: 5 },
    { id: classRowId(C, 1, 14), level: 13, amount: 5 },
    { id: classRowId(C, 1, 15), level: 14, amount: 5 },
    { id: classRowId(C, 1, 16), level: 15, amount: 5 },
    { id: classRowId(C, 1, 17), level: 16, amount: 5 },
    { id: classRowId(C, 1, 18), level: 17, amount: 5 },
    { id: classRowId(C, 1, 19), level: 18, amount: 5 },
    { id: classRowId(C, 1, 20), level: 19, amount: 5 },
    { id: classRowId(C, 1, 21), level: 20, amount: 5 }
  ]
}

const clericSpellLimits = [
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
]

/** Channel Divinity's uses, shared by Turn Undead and every domain's Channel Divinity effect. */
const channelDivinityCharge = {
  id: classRowId(C, 0x66, 3),
  limitKind: 'FIXED_AMOUNT' as const,
  scalingKind: SCALING.PER_LEVEL,
  resetKind: 'SHORT_REST' as const,
  levels: [
    { id: classRowId(C, 0x67, 1), level: 2, amount: 1 },
    { id: classRowId(C, 0x67, 2), level: 6, amount: 2 },
    { id: classRowId(C, 0x67, 3), level: 18, amount: 3 }
  ]
}

export const cleric: ClassAuthored = {
  id: CLASS_IDS.CLERIC,
  label: 'Cleric',
  category: CLASS_CATEGORY.BASE,
  subclassSelectionLevel: 1,
  attributes: [CLASS_ATTRIBUTE.SPELLCASTER],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,

  hitpoint: {
    dieConfig: 'd8'
  },

  startingGold: {
    multiplier: 10,
    currencyId: goldCurrencyId,
    dieConfig: '5d4'
  },

  multiclass: {
    id: classRowId(C, 99, 1),
    requirementGroups: {
      groups: [
        {
          id: classRowId(C, 99, 2),
          requirements: [{ id: classRowId(C, 99, 3), ability: ABILITY_CODE.WISDOM, min: 13 }]
        }
      ]
    },
    proficiencies: [
      {
        id: classRowId(C, 99, 4),
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
    id: classRowId(C, 98, 1),
    sets: [
      {
        id: classRowId(C, 98, 2),
        order: 0,
        groups: [
          {
            id: classRowId(C, 98, 3),
            order: 0,
            options: [
              {
                id: classRowId(C, 98, 4),
                order: 0,
                items: [
                  {
                    id: classRowId(C, 98, 5),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(7)],
                    quantity: 1
                  }
                ]
              },
              {
                id: classRowId(C, 98, 6),
                order: 1,
                eligibility: {
                  id: classRowId(C, 0x6b, 1),
                  groups: [
                    {
                      id: classRowId(C, 0x6b, 2),
                      order: 0,
                      contexts: [
                        {
                          id: classRowId(C, 0x6b, 3),
                          order: 0,
                          subject: 'CHARACTER',
                          conditions: [
                            {
                              id: classRowId(C, 0x6b, 4),
                              order: 0,
                              kind: 'PREDICATE',
                              constraint: 'INCLUDE',
                              predicateCode: 'EQUIPMENT_PROFICIENCY',
                              authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                              equipmentIds: [equipmentId(31)],
                              level: SCALING_AMOUNT_KIND.FULL
                            }
                          ]
                        }
                      ]
                    },
                    {
                      id: classRowId(C, 0x6b, 5),
                      order: 1,
                      contexts: [
                        {
                          id: classRowId(C, 0x6b, 6),
                          order: 0,
                          subject: 'CHARACTER',
                          conditions: [
                            {
                              id: classRowId(C, 0x6b, 7),
                              order: 0,
                              kind: 'PREDICATE',
                              constraint: 'INCLUDE',
                              predicateCode: 'EQUIPMENT_PROPERTY_PROFICIENCY',
                              authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                              category: EQUIPMENT_CATEGORY_CODE.WEAPON,
                              properties: [EQUIPMENT_PROPERTY_CODE.MARTIAL]
                            }
                          ]
                        }
                      ]
                    }
                  ]
                },
                items: [
                  {
                    id: classRowId(C, 98, 7),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(31)],
                    quantity: 1
                  }
                ]
              }
            ]
          },
          {
            id: classRowId(C, 98, 8),
            order: 1,
            options: [
              {
                id: classRowId(C, 98, 9),
                order: 0,
                items: [
                  {
                    id: classRowId(C, 98, 10),
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
                id: classRowId(C, 98, 11),
                order: 1,
                items: [
                  {
                    id: classRowId(C, 98, 12),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(39)],
                    quantity: 1
                  }
                ]
              },
              {
                id: classRowId(C, 98, 13),
                order: 2,
                eligibility: {
                  id: classRowId(C, 0x6b, 8),
                  groups: [
                    {
                      id: classRowId(C, 0x6b, 9),
                      order: 0,
                      contexts: [
                        {
                          id: classRowId(C, 0x6b, 10),
                          order: 0,
                          subject: 'CHARACTER',
                          conditions: [
                            {
                              id: classRowId(C, 0x6b, 11),
                              order: 0,
                              kind: 'PREDICATE',
                              constraint: 'INCLUDE',
                              predicateCode: 'EQUIPMENT_PROFICIENCY',
                              authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                              equipmentIds: [equipmentId(47)],
                              level: SCALING_AMOUNT_KIND.FULL
                            }
                          ]
                        }
                      ]
                    },
                    {
                      id: classRowId(C, 0x6b, 12),
                      order: 1,
                      contexts: [
                        {
                          id: classRowId(C, 0x6b, 13),
                          order: 0,
                          subject: 'CHARACTER',
                          conditions: [
                            {
                              id: classRowId(C, 0x6b, 14),
                              order: 0,
                              kind: 'PREDICATE',
                              constraint: 'INCLUDE',
                              predicateCode: 'EQUIPMENT_PROPERTY_PROFICIENCY',
                              authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                              category: EQUIPMENT_CATEGORY_CODE.ARMOR,
                              properties: [EQUIPMENT_PROPERTY_CODE.HEAVY]
                            }
                          ]
                        }
                      ]
                    }
                  ]
                },
                items: [
                  {
                    id: classRowId(C, 98, 14),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(47)],
                    quantity: 1
                  }
                ]
              }
            ]
          },
          {
            id: classRowId(C, 98, 15),
            order: 2,
            options: [
              {
                id: classRowId(C, 98, 16),
                order: 0,
                items: [
                  {
                    id: classRowId(C, 98, 17),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(11)],
                    quantity: 1
                  },
                  {
                    id: classRowId(C, 98, 18),
                    order: 1,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(101)],
                    quantity: 20
                  }
                ]
              },
              {
                id: classRowId(C, 98, 19),
                order: 1,
                items: [
                  {
                    id: classRowId(C, 98, 20),
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
            id: classRowId(C, 98, 21),
            order: 3,
            options: [
              {
                id: classRowId(C, 98, 22),
                order: 0,
                items: [
                  {
                    id: classRowId(C, 98, 23),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(187)],
                    quantity: 1
                  }
                ]
              },
              {
                id: classRowId(C, 98, 24),
                order: 1,
                items: [
                  {
                    id: classRowId(C, 98, 25),
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
            id: classRowId(C, 98, 26),
            order: 4,
            options: [
              {
                id: classRowId(C, 98, 27),
                order: 0,
                items: [
                  {
                    id: classRowId(C, 98, 28),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
                    authoringModeKind: AUTHORING_MODE_KIND.ALL,
                    category: EQUIPMENT_CATEGORY_CODE.SHIELD,
                    count: 1
                  },
                  {
                    id: classRowId(C, 98, 29),
                    order: 1,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [96, 97, 98].map(equipmentId),
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
    details: classSpellcastingDetails(C, [
      {
        label: 'Spellcasting',
        description: '<p>As a conduit for divine power, you can cast cleric spells.</p>'
      },
      {
        label: 'Cantrips',
        description:
          '<p>At 1st level, you know three cantrips of your choice from the cleric spell list. You learn additional cleric cantrips of your choice at higher levels, as shown in the Cantrips Known column of the Cleric table.</p>'
      },
      {
        label: 'Preparing and Casting Spells',
        description:
          "<p>The Cleric table shows how many spell slots you have to cast your spells of 1st level and higher. To cast one of these spells, you must expend a slot of the spell's level or higher. You regain all expended spell slots when you finish a long rest.</p><p>You prepare the list of cleric spells that are available for you to cast, choosing from the cleric spell list. When you do so, choose a number of cleric spells equal to your Wisdom modifier + your cleric level (minimum of one spell). The spells must be of a level for which you have spell slots.</p><p>For example, if you are a 3rd-level cleric, you have four 1st-level and two 2nd-level spell slots. With a Wisdom of 16, your list of prepared spells can include six spells of 1st or 2nd level, in any combination. If you prepare the 1st-level spell <em>cure wounds</em>, you can cast it using a 1st-level or 2nd-level slot. Casting the spell doesn't remove it from your list of prepared spells.</p><p>You can change your list of prepared spells when you finish a long rest. Preparing a new list of cleric spells requires time spent in prayer and meditation: at least 1 minute per spell level for each spell on your list.</p>"
      },
      {
        label: 'Spellcasting Ability',
        description:
          '<p>Wisdom is your spellcasting ability for your cleric spells. The power of your spells comes from your devotion to your deity. You use your Wisdom whenever a cleric spell refers to your spellcasting ability. In addition, you use your Wisdom modifier when setting the saving throw DC for a cleric spell you cast and when making an attack roll with one.</p><p><strong>Spell save DC</strong> = 8 + your proficiency bonus + your Wisdom modifier</p><p><strong>Spell attack modifier</strong> = your proficiency bonus + your Wisdom modifier</p>'
      },
      {
        label: 'Ritual Casting',
        description:
          '<p>You can cast a cleric spell as a ritual if that spell has the ritual tag and you have the spell prepared.</p>'
      },
      {
        label: 'Spellcasting Focus',
        description:
          '<p>You can use a holy symbol (see "Equipment") as a spellcasting focus for your cleric spells.</p>'
      }
    ]),
    charges: clericSlotCharge,
    spellLimits: clericSpellLimits
  },

  proficiencies: [
    // Light armor
    {
      id: classRowId(C, 2, 1),
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
      id: classRowId(C, 2, 2),
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
      id: classRowId(C, 2, 3),
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
      id: classRowId(C, 2, 4),
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
    // Saving throws: WIS, CHA
    {
      id: classRowId(C, 2, 5),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SAVE_ABILITY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      abilities: [ABILITY_CODE.WISDOM, ABILITY_CODE.CHARISMA],
      order: 4
    },
    // Skills: choose 2 from History, Insight, Medicine, Persuasion, Religion
    {
      id: classRowId(C, 2, 6),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SKILL,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
      scalingKind: SCALING.NONE,
      count: 2,
      selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      skillIds: [
        skillId('HISTORY'),
        skillId('INSIGHT'),
        skillId('MEDICINE'),
        skillId('PERSUASION'),
        skillId('RELIGION')
      ],
      order: 5
    }
  ],

  resources: {
    order: 0,
    id: classRowId(C, 0x65, 3),
    label: 'Channel Divinity',
    availableAtLevel: 2,
    charges: channelDivinityCharge
  },

  features: [
    {
      id: classRowId(C, 3, 1),
      label: 'Spellcasting',
      description: 'As a conduit for divine power, you can cast cleric spells.',
      availableAtLevel: 1,
      order: 0
    },
    {
      id: classRowId(C, 3, 2),
      label: 'Divine Domain',
      description:
        'Choose one domain related to your deity, such as Life. Each domain is detailed at the end of the class description, and each one provides examples of gods associated with it. Your choice grants you domain spells and other features when you choose it at 1st level. It also grants you additional ways to use Channel Divinity when you gain that feature at 2nd level, and additional benefits at 6th, 8th, and 17th levels.',
      attributes: [FEATURE_ATTRIBUTE.SUBCLASS_SELECTION],
      availableAtLevel: 1,
      order: 1
    },
    {
      id: classRowId(C, 3, 3),
      label: 'Channel Divinity',
      description:
        'At 2nd level, you gain the ability to channel divine energy directly from your deity, using that energy to fuel magical effects. You start with two such effects: Turn Undead and an effect determined by your domain. Some domains grant you additional effects as you advance in levels, as noted in the domain description. When you use your Channel Divinity, you choose which effect to create. You must then finish a short or long rest to use your Channel Divinity again. Some Channel Divinity effects require saving throws. When you use such an effect from this class, the DC equals your cleric spell save DC. Beginning at 6th level, you can use your Channel Divinity twice between rests, and beginning at 18th level, you can use it three times between rests. When you finish a short or long rest, you regain your expended uses.',
      attributes: [FEATURE_ATTRIBUTE.LIMITED_USE],
      availableAtLevel: 2,
      order: 2,
      effects: [
        closedRuleEffect({
          id: classRowId(C, 0x60, 3),
          ruleKind: CLOSED_RULE_KIND.CLASS_CLERIC_CHANNEL_DIVINITY_TURN_UNDEAD,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          invocation: {
            kind: 'ACTION',
            triggerCode: TRIGGER.SAVING_THROW,
            resourceUse: { chargeId: channelDivinityCharge.id, cost: 1 },
            activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
            savingThrow: {
              id: classRowId(C, 0x6e, 3),
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM,
              dcMethod: SAVING_THROW_DC_METHOD.SOURCE_SAVE_DC
            },
            range: { id: classRowId(C, 0x69, 3), rangeKind: RANGE_KIND.SELF },
            shape: {
              id: classRowId(C, 0x6f, 3),
              shapeKind: SHAPE_KIND.SPHERE,
              radius: { amount: 30, unit: MEASUREMENT_UNIT_CODE.FEET }
            },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
              dispositionKind: 'ANY'
            }
          }
        })
      ]
    },
    {
      id: classRowId(C, 3, 4),
      label: 'Divine Domain Feature',
      description:
        'Choose one domain related to your deity, such as Life. Each domain is detailed at the end of the class description, and each one provides examples of gods associated with it. Your choice grants you domain spells and other features when you choose it at 1st level. It also grants you additional ways to use Channel Divinity when you gain that feature at 2nd level, and additional benefits at 6th, 8th, and 17th levels.',
      availableAtLevel: 2,
      order: 3
    },
    {
      id: classRowId(C, 3, 5),
      label: 'Ability Score Improvement',
      description: abilityScoreImprovementDescription,
      availableAtLevel: 4,
      order: 4,
      optionChoices: [{ level: 4, count: 1 }],
      options: abilityScoreImprovementOptions(
        (optionEntry) => classRowId(C, 5, optionEntry),
        abilityScoreImprovementDescription
      ),
      effects: [selfClassRuleEffect(5, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)]
    },
    {
      id: classRowId(C, 3, 6),
      label: 'Destroy Undead',
      description:
        'Starting at 5th level, when an undead fails its saving throw against your Turn Undead feature, the creature is instantly destroyed if its challenge rating is at or below a certain threshold, as shown in the Destroy Undead table.',
      availableAtLevel: 5,
      order: 5,
      effects: [
        closedRuleEffect({
          id: classRowId(C, 0x60, 6),
          ruleKind: CLOSED_RULE_KIND.CLASS_CLERIC_DESTROY_UNDEAD,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.SAVING_THROW,
            savingThrow: {
              id: classRowId(C, 0x6e, 6),
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM,
              dcMethod: SAVING_THROW_DC_METHOD.SOURCE_SAVE_DC
            },
            range: { id: classRowId(C, 0x69, 6), rangeKind: RANGE_KIND.SELF },
            shape: {
              id: classRowId(C, 0x6f, 6),
              shapeKind: SHAPE_KIND.SPHERE,
              radius: { amount: 30, unit: MEASUREMENT_UNIT_CODE.FEET }
            },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
              dispositionKind: 'ANY'
            }
          }
        })
      ]
    },
    {
      id: classRowId(C, 3, 7),
      label: 'Divine Domain Feature',
      description:
        'Choose one domain related to your deity, such as Life. Each domain is detailed at the end of the class description, and each one provides examples of gods associated with it. Your choice grants you domain spells and other features when you choose it at 1st level. It also grants you additional ways to use Channel Divinity when you gain that feature at 2nd level, and additional benefits at 6th, 8th, and 17th levels.',
      availableAtLevel: 6,
      order: 6
    },
    {
      id: classRowId(C, 3, 8),
      label: 'Ability Score Improvement',
      description: abilityScoreImprovementDescription,
      availableAtLevel: 8,
      order: 7,
      optionChoices: [{ level: 8, count: 1 }],
      options: abilityScoreImprovementOptions(
        (optionEntry) => classRowId(C, 8, optionEntry),
        abilityScoreImprovementDescription
      ),
      effects: [selfClassRuleEffect(8, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)]
    },
    {
      id: classRowId(C, 3, 9),
      label: 'Divine Domain Feature',
      description:
        'Choose one domain related to your deity, such as Life. Each domain is detailed at the end of the class description, and each one provides examples of gods associated with it. Your choice grants you domain spells and other features when you choose it at 1st level. It also grants you additional ways to use Channel Divinity when you gain that feature at 2nd level, and additional benefits at 6th, 8th, and 17th levels.',
      availableAtLevel: 8,
      order: 8
    },
    {
      id: classRowId(C, 3, 10),
      label: 'Ability Score Improvement',
      description: abilityScoreImprovementDescription,
      availableAtLevel: 12,
      order: 9,
      optionChoices: [{ level: 12, count: 1 }],
      options: abilityScoreImprovementOptions(
        (optionEntry) => classRowId(C, 10, optionEntry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(10, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(C, 3, 11),
      label: 'Divine Intervention',
      description:
        "Beginning at 10th level, you can call on your deity to intervene on your behalf when your need is great. Imploring your deity's aid requires you to use your action. Describe the assistance you seek, and roll percentile dice. If you roll a number equal to or lower than your cleric level, your deity intervenes. The GM chooses the nature of the intervention; the effect of any cleric spell or cleric domain spell would be appropriate. If your deity intervenes, you can't use this feature again for 7 days. Otherwise, you can use it again after you finish a long rest. At 20th level, your call for intervention succeeds automatically, no roll required.",
      availableAtLevel: 10,
      order: 10,
      attributes: [FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: divineInterventionCharge,
      effects: [divineInterventionEffect]
    },
    {
      id: classRowId(C, 3, 12),
      label: 'Divine Domain Feature',
      description:
        'Choose one domain related to your deity, such as Life. Each domain is detailed at the end of the class description, and each one provides examples of gods associated with it. Your choice grants you domain spells and other features when you choose it at 1st level. It also grants you additional ways to use Channel Divinity when you gain that feature at 2nd level, and additional benefits at 6th, 8th, and 17th levels.',
      availableAtLevel: 17,
      order: 11
    },
    {
      id: classRowId(C, 3, 13),
      label: 'Ability Score Improvement',
      description: abilityScoreImprovementDescription,
      availableAtLevel: 16,
      order: 12,
      optionChoices: [{ level: 16, count: 1 }],
      options: abilityScoreImprovementOptions(
        (optionEntry) => classRowId(C, 13, optionEntry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(13, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(C, 3, 14),
      label: 'Ability Score Improvement',
      description: abilityScoreImprovementDescription,
      availableAtLevel: 19,
      order: 13,
      optionChoices: [{ level: 19, count: 1 }],
      options: abilityScoreImprovementOptions(
        (optionEntry) => classRowId(C, 14, optionEntry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(14, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    }
  ]
}
