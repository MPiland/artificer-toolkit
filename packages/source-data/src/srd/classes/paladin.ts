import {
  ACTIVATION_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_DUPLICATE_POLICY,
  AUTHORING_SELECTION_KIND,
  CLASS_ATTRIBUTE,
  CHARGE_BONUS_KIND,
  CLASS_CATEGORY,
  CLOSED_RULE_KIND,
  EFFECT_KIND,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  FEATURE_ATTRIBUTE,
  GRANT_KIND,
  MANIFEST_KIND,
  MANUAL_ADJUDICATION_REASON,
  MEASUREMENT_UNIT_CODE,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  PROFICIENCY_KIND,
  RANGE_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  SHAPE_KIND,
  SPELLCASTING_ATTRIBUTE,
  STARTING_EQUIPMENT_KIND,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  type ActivationCode,
  type ClassAuthored,
  type ClosedRuleKind,
  type EffectAuthored,
  type FacetAuthored,
  type ShapeAuthored,
  type TargetingAuthored
} from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import { creatureTypeId } from '../spells/shared.js'
import { CLASS_IDS } from '../ids.js'
import { classSpellcastingDetails } from './spellcasting-details.js'
import {
  SRD_CREATURE_TYPES,
  SRD_CURRENCIES,
  SRD_DAMAGE_TYPES,
  SRD_SKILLS,
  SRD_SYSTEM_ID,
  SRD_USER_ID,
  ABILITY_CODE
} from '../vocabulary.js'
import {
  abilityScoreImprovementOptions,
  attacksPerAttackActionGrant,
  closedRuleEffect,
  duelingRestriction
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

const P = 7 // Paladin class index

const abilityScoreImprovementDescription =
  "When you reach 4th level, and again at 8th, 12th, 16th, and 19th level, you can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1. As normal, you can't increase an ability score above 20 using this feature."

function selfClassRuleEffect(
  entry: number,
  ruleKind: ClosedRuleKind,
  activationCode?: Exclude<ActivationCode, 'FREE'>
): EffectAuthored {
  const range = { id: classRowId(P, 0x69, entry), rangeKind: RANGE_KIND.SELF } as const
  return closedRuleEffect({
    id: classRowId(P, 0x60, entry),
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

/** A paladin aura's reach (D155): 10 feet, growing to 30 feet at paladin level 18. */
function paladinAuraShape(group: number, entry: number): ShapeAuthored {
  return {
    id: classRowId(P, group, entry),
    shapeKind: SHAPE_KIND.SPHERE,
    radius: {
      amount: 10,
      unit: MEASUREMENT_UNIT_CODE.FEET,
      scaling: {
        scalingKind: 'BREAKPOINTS',
        scalingSource: 'CLASS_LEVEL',
        classId: CLASS_IDS.PALADIN,
        breakpoints: [
          {
            id: classRowId(P, group, entry + 1),
            level: 18,
            order: 1,
            value: { amount: 30, unit: MEASUREMENT_UNIT_CODE.FEET }
          }
        ]
      }
    }
  }
}

/**
 * A paladin aura keeping conditions off the paladin and allies within it while the paladin is
 * conscious (D155 occupant condition immunity), its rows drawn from `group`.
 */
export function paladinConditionImmunityAura(input: {
  id: string
  rangeId: string
  group: number
  label: string
  conditionCodes: readonly string[]
}): EffectAuthored {
  const rowId = (entry: number) => classRowId(P, input.group, entry)
  return {
    id: input.id,
    order: 1,
    invocation: {
      kind: 'PASSIVE',
      triggerCode: TRIGGER.ACTIVATED,
      range: { id: input.rangeId, rangeKind: RANGE_KIND.SELF },
      targeting: {
        selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
        dispositionKind: TARGET_DISPOSITION_KIND.ANY
      },
      shape: paladinAuraShape(input.group, 0)
    },
    paths: [
      {
        id: rowId(2),
        order: 1,
        pathCode: PATH_CODE.ON_USE,
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: {
          id: rowId(3),
          resultKind: 'SINGLE',
          outcomes: [
            {
              id: rowId(4),
              effectKind: EFFECT_KIND.MANIFEST,
              manifestKind: MANIFEST_KIND.ZONE,
              attachmentKind: 'SOURCE',
              label: input.label,
              shape: paladinAuraShape(input.group, 5),
              components: [
                {
                  id: rowId(7),
                  order: 1,
                  label: input.label,
                  occupantConditionImmunity: {
                    id: rowId(8),
                    conditionTypeIds: input.conditionCodes.map(conditionTypeId),
                    dispositionFilter: 'ALLIES_AND_SOURCE'
                  }
                }
              ]
            }
          ]
        }
      }
    ]
  }
}
function vocabularyEntryId(entries: readonly { id: string; code: string }[], code: string): string {
  const entry = entries.find((candidate) => candidate.code === code)
  if (!entry) throw new Error(`SRD vocabulary entry ${code} required.`)
  return entry.id
}

/** Divine Smite and Improved Divine Smite share one id scheme: eight ids per Feature row in each group. */
function smiteId(group: number, feature: number, part: number): string {
  return classRowId(P, group, feature * 8 + part)
}

/** The target must be an undead or a fiend. */
function undeadOrFiendTarget(feature: number): FacetAuthored {
  return {
    id: smiteId(0x65, feature, 0),
    groups: [
      {
        id: smiteId(0x65, feature, 1),
        order: 0,
        contexts: [
          {
            id: smiteId(0x65, feature, 2),
            order: 0,
            subject: 'CREATURE',
            authoringModeKind: AUTHORING_MODE_KIND.ALL,
            conditions: [
              {
                id: smiteId(0x65, feature, 3),
                order: 0,
                kind: 'PREDICATE',
                constraint: 'INCLUDE',
                predicateCode: 'CREATURE_TYPE',
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                creatureTypeIds: [
                  vocabularyEntryId(SRD_CREATURE_TYPES, 'UNDEAD'),
                  vocabularyEntryId(SRD_CREATURE_TYPES, 'FIEND')
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}

/** An on-hit radiant damage path of a smite Feature, with its dice fixed or keyed by the slot level spent. */
function smiteRadiantPath(
  feature: number,
  part: number,
  damage:
    | { diceConfig: string }
    | { levels: readonly (readonly [level: number, diceConfig: string])[] },
  restrictions?: FacetAuthored
): EffectAuthored['paths'][number] {
  const outcome = {
    id: smiteId(0x63, feature, part),
    effectKind: EFFECT_KIND.DAMAGE,
    damageTypeId: vocabularyEntryId(SRD_DAMAGE_TYPES, 'RADIANT'),
    valueKind: 'DICE' as const
  }
  return {
    id: smiteId(0x61, feature, part),
    order: part + 1,
    pathCode: PATH_CODE.ON_HIT,
    groupType: PATH_GROUP_TYPE.SINGLE,
    originKind: 'SOURCE',
    selectionKind: 'FIXED',
    ...(restrictions ? { restrictions } : {}),
    resultBlock: {
      id: smiteId(0x62, feature, part),
      resultKind: 'SINGLE',
      outcomes: [
        'diceConfig' in damage
          ? { ...outcome, scalingKind: SCALING.NONE, diceConfig: damage.diceConfig }
          : {
              ...outcome,
              scalingKind: SCALING.PER_LEVEL,
              scalingSource: 'SPELL_CAST_LEVEL',
              levels: damage.levels.map(([level, diceConfig], index) => ({
                id: smiteId(0x64, feature, index),
                level,
                order: index + 1,
                diceConfig
              }))
            }
      ]
    }
  }
}

/** A melee weapon hit's passive invocation, optionally paid for with a spell slot. */
function smiteInvocation(feature: number, optionalOnHit?: { kind: 'SPELL_SLOT' }) {
  return {
    kind: 'PASSIVE',
    triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
    range: { id: classRowId(P, 0x69, feature), rangeKind: RANGE_KIND.SPECIAL },
    targeting: {
      selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
      dispositionKind: TARGET_DISPOSITION_KIND.HOSTILE
    },
    ...(optionalOnHit ? { optionalOnHit } : {})
  } as const
}

// Paladin spell slot charge — half caster (starts L2), resets on long rest
const paladinSlotCharge = {
  id: classRowId(P, 1, 1),
  limitKind: 'FIXED_AMOUNT' as const,
  scalingKind: SCALING.PER_LEVEL,
  resetKind: 'LONG_REST' as const,
  levels: [
    { id: classRowId(P, 1, 2), level: 2, amount: 2 },
    { id: classRowId(P, 1, 3), level: 3, amount: 3 },
    { id: classRowId(P, 1, 4), level: 4, amount: 3 },
    { id: classRowId(P, 1, 5), level: 5, amount: 4 },
    { id: classRowId(P, 1, 6), level: 6, amount: 4 },
    { id: classRowId(P, 1, 7), level: 7, amount: 4 },
    { id: classRowId(P, 1, 8), level: 8, amount: 4 },
    { id: classRowId(P, 1, 9), level: 9, amount: 4 },
    { id: classRowId(P, 1, 10), level: 10, amount: 4 },
    { id: classRowId(P, 1, 11), level: 11, amount: 5 },
    { id: classRowId(P, 1, 12), level: 12, amount: 5 },
    { id: classRowId(P, 1, 13), level: 13, amount: 5 },
    { id: classRowId(P, 1, 14), level: 14, amount: 5 },
    { id: classRowId(P, 1, 15), level: 15, amount: 5 },
    { id: classRowId(P, 1, 16), level: 16, amount: 5 },
    { id: classRowId(P, 1, 17), level: 17, amount: 5 },
    { id: classRowId(P, 1, 18), level: 18, amount: 5 },
    { id: classRowId(P, 1, 19), level: 19, amount: 5 },
    { id: classRowId(P, 1, 20), level: 20, amount: 5 }
  ]
}

const paladinSpellLimits = [
  { classLevel: 2, slots: [{ spellLevel: 1, slotCount: 2 }] },
  { classLevel: 3, slots: [{ spellLevel: 1, slotCount: 3 }] },
  { classLevel: 4, slots: [{ spellLevel: 1, slotCount: 3 }] },
  {
    classLevel: 5,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 2 }
    ]
  },
  {
    classLevel: 6,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 2 }
    ]
  },
  {
    classLevel: 7,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 }
    ]
  },
  {
    classLevel: 8,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 }
    ]
  },
  {
    classLevel: 9,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 2 }
    ]
  },
  {
    classLevel: 10,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 2 }
    ]
  },
  {
    classLevel: 11,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 }
    ]
  },
  {
    classLevel: 12,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 }
    ]
  },
  {
    classLevel: 13,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 1 }
    ]
  },
  {
    classLevel: 14,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 1 }
    ]
  },
  {
    classLevel: 15,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 2 }
    ]
  },
  {
    classLevel: 16,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 2 }
    ]
  },
  {
    classLevel: 17,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 1 }
    ]
  },
  {
    classLevel: 18,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 1 }
    ]
  },
  {
    classLevel: 19,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 2 }
    ]
  },
  {
    classLevel: 20,
    slots: [
      { spellLevel: 1, slotCount: 4 },
      { spellLevel: 2, slotCount: 3 },
      { spellLevel: 3, slotCount: 3 },
      { spellLevel: 4, slotCount: 3 },
      { spellLevel: 5, slotCount: 2 }
    ]
  }
]

/** Lay on Hands has no effect on undead and constructs; healing and curing share the one touch. */
const LAY_ON_HANDS_TARGETING: TargetingAuthored = {
  selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
  dispositionKind: TARGET_DISPOSITION_KIND.ANY,
  excludedCreatureTypeIds: [creatureTypeId('UNDEAD'), creatureTypeId('CONSTRUCT')]
}

export const paladin: ClassAuthored = {
  id: CLASS_IDS.PALADIN,
  label: 'Paladin',
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
    id: classRowId(P, 99, 1),
    requirementGroups: {
      groups: [
        {
          id: classRowId(P, 99, 2),
          requirements: [
            { id: classRowId(P, 99, 3), ability: ABILITY_CODE.STRENGTH, min: 13 },
            { id: classRowId(P, 99, 4), ability: ABILITY_CODE.CHARISMA, min: 13 }
          ]
        }
      ]
    },
    proficiencies: [
      {
        id: classRowId(P, 99, 5),
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
    id: classRowId(P, 98, 1),
    sets: [
      {
        id: classRowId(P, 98, 2),
        order: 0,
        groups: [
          {
            id: classRowId(P, 98, 3),
            order: 0,
            options: [
              {
                id: classRowId(P, 98, 4),
                order: 0,
                items: [
                  {
                    id: classRowId(P, 98, 5),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
                    authoringModeKind: AUTHORING_MODE_KIND.ALL,
                    category: EQUIPMENT_CATEGORY_CODE.WEAPON,
                    properties: [EQUIPMENT_PROPERTY_CODE.MARTIAL],
                    count: 1
                  },
                  {
                    id: classRowId(P, 98, 6),
                    order: 1,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
                    authoringModeKind: AUTHORING_MODE_KIND.ALL,
                    category: EQUIPMENT_CATEGORY_CODE.SHIELD,
                    count: 1
                  }
                ]
              },
              {
                id: classRowId(P, 98, 7),
                order: 1,
                items: [
                  {
                    id: classRowId(P, 98, 8),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
                    authoringModeKind: AUTHORING_MODE_KIND.ALL,
                    category: EQUIPMENT_CATEGORY_CODE.WEAPON,
                    properties: [EQUIPMENT_PROPERTY_CODE.MARTIAL],
                    count: 2
                  }
                ]
              }
            ]
          },
          {
            id: classRowId(P, 98, 9),
            order: 1,
            options: [
              {
                id: classRowId(P, 98, 10),
                order: 0,
                items: [
                  {
                    id: classRowId(P, 98, 11),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(5)],
                    quantity: 5
                  }
                ]
              },
              {
                id: classRowId(P, 98, 12),
                order: 1,
                items: [
                  {
                    id: classRowId(P, 98, 13),
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
            id: classRowId(P, 98, 14),
            order: 2,
            options: [
              {
                id: classRowId(P, 98, 15),
                order: 0,
                items: [
                  {
                    id: classRowId(P, 98, 16),
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
                id: classRowId(P, 98, 17),
                order: 1,
                items: [
                  {
                    id: classRowId(P, 98, 18),
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
            id: classRowId(P, 98, 19),
            order: 3,
            options: [
              {
                id: classRowId(P, 98, 20),
                order: 0,
                items: [
                  {
                    id: classRowId(P, 98, 21),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(47)],
                    quantity: 1
                  },
                  {
                    id: classRowId(P, 98, 22),
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
    availableAtLevel: 2,
    order: 0,
    ability: ABILITY_CODE.CHARISMA,
    maxSpellLevel: 5,
    attributes: [SPELLCASTING_ATTRIBUTE.PREPARES_SPELLS],
    prepareLimit: {
      methodKinds: ['SPELLCASTING_ABILITY', 'CLASS_LEVEL'],
      scaling: SCALING_AMOUNT_KIND.HALF,
      rounding: 'DOWN'
    },
    details: classSpellcastingDetails(P, [
      {
        label: 'Spellcasting',
        description:
          '<p>By 2nd level, you have learned to draw on divine magic through meditation and prayer to cast spells as a cleric does.</p>'
      },
      {
        label: 'Preparing and Casting Spells',
        description:
          "<p>The Paladin table shows how many spell slots you have to cast your spells. To cast one of your paladin spells of 1st level or higher, you must expend a slot of the spell's level or higher. You regain all expended spell slots when you finish a long rest.</p><p>You prepare the list of paladin spells that are available for you to cast, choosing from the paladin spell list. When you do so, choose a number of paladin spells equal to your Charisma modifier + half your paladin level, rounded down (minimum of one spell). The spells must be of a level for which you have spell slots.</p><p>For example, if you are a 5th-level paladin, you have four 1st-level and two 2nd-level spell slots. With a Charisma of 14, your list of prepared spells can include four spells of 1st or 2nd level, in any combination. If you prepare the 1st-level spell <em>cure wounds</em>, you can cast it using a 1st-level or a 2nd-level slot. Casting the spell doesn't remove it from your list of prepared spells.</p><p>You can change your list of prepared spells when you finish a long rest. Preparing a new list of paladin spells requires time spent in prayer and meditation: at least 1 minute per spell level for each spell on your list.</p>"
      },
      {
        label: 'Spellcasting Ability',
        description:
          '<p>Charisma is your spellcasting ability for your paladin spells, since their power derives from the strength of your convictions. You use your Charisma whenever a spell refers to your spellcasting ability. In addition, you use your Charisma modifier when setting the saving throw DC for a paladin spell you cast and when making an attack roll with one.</p><p><strong>Spell save DC</strong> = 8 + your proficiency bonus + your Charisma modifier</p><p><strong>Spell attack modifier</strong> = your proficiency bonus + your Charisma modifier</p>'
      },
      {
        label: 'Spellcasting Focus',
        description:
          '<p>You can use a holy symbol as a spellcasting focus for your paladin spells.</p>'
      }
    ]),
    charges: paladinSlotCharge,
    spellLimits: paladinSpellLimits
  },

  proficiencies: [
    // All armor
    {
      id: classRowId(P, 2, 1),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      properties: ['LIGHT', 'MEDIUM', 'HEAVY'],
      category: 'ARMOR',
      order: 0
    },
    // Shields
    {
      id: classRowId(P, 2, 2),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.ALL,
      category: 'SHIELD',
      order: 1
    },
    // Simple weapons
    {
      id: classRowId(P, 2, 3),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      properties: ['SIMPLE'],
      category: 'WEAPON',
      order: 2
    },
    // Martial weapons
    {
      id: classRowId(P, 2, 4),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      properties: ['MARTIAL'],
      category: 'WEAPON',
      order: 3
    },
    // Saving throws: WIS, CHA
    {
      id: classRowId(P, 2, 5),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SAVE_ABILITY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      abilities: [ABILITY_CODE.WISDOM, ABILITY_CODE.CHARISMA],
      order: 4
    },
    // Skills: choose 2 from Athletics, Insight, Intimidation, Medicine, Persuasion, Religion
    {
      id: classRowId(P, 2, 6),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SKILL,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
      scalingKind: SCALING.NONE,
      count: 2,
      selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      skillIds: [
        skillId('ATHLETICS'),
        skillId('INSIGHT'),
        skillId('INTIMIDATION'),
        skillId('MEDICINE'),
        skillId('PERSUASION'),
        skillId('RELIGION')
      ],
      order: 5
    }
  ],

  features: [
    {
      id: classRowId(P, 3, 1),
      label: 'Divine Sense',
      description:
        'The presence of strong evil registers on your senses like a noxious odor, and powerful good rings like heavenly music in your ears. As an action, you can open your awareness to detect such forces. Until the end of your next turn, you know the location of any celestial, fiend, or undead within 60 feet of you that is not behind total cover. You know the type (celestial, fiend, or undead) of any being whose presence you sense, but not its identity (the vampire Count Strahd von Zarovich, for instance). Within the same radius, you also detect the presence of any place or object that has been consecrated or desecrated, as with the hallow spell.\n\nYou can use this feature a number of times equal to 1 + your Charisma modifier. When you finish a long rest, you regain all expended uses.',
      attributes: [FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: classRowId(P, 0x66, 1),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: SCALING.NONE,
        resetKind: 'LONG_REST',
        amount: 1,
        bonuses: [
          {
            id: classRowId(P, 0x67, 1),
            bonusKind: CHARGE_BONUS_KIND.ABILITY_MODIFIER,
            ability: ABILITY_CODE.CHARISMA,
            order: 0
          }
        ]
      },
      // Detection stays manual: the engine has no creature-type sense (D156).
      effects: [
        {
          id: classRowId(P, 0x60, 1),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: TRIGGER.ACTIVATED,
            resourceUse: { chargeId: classRowId(P, 0x66, 1), cost: 1 },
            activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: classRowId(P, 0x69, 1), rangeKind: RANGE_KIND.SELF },
            targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
          },
          paths: [
            {
              id: classRowId(P, 0x80, 1),
              order: 1,
              pathCode: PATH_CODE.ON_USE,
              groupType: PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: classRowId(P, 0x81, 1),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: classRowId(P, 0x82, 1),
                    effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
                    label: 'Sense Celestials, Fiends and Undead',
                    reasonCode: MANUAL_ADJUDICATION_REASON.EXTERNAL_WORLD_STATE,
                    instructions:
                      'Until the end of your next turn, you know the location and type of any celestial, fiend or undead within 60 feet of you that is not behind total cover, and any consecrated or desecrated place or object within 60 feet.'
                  }
                ]
              }
            }
          ]
        }
      ],
      availableAtLevel: 1,
      order: 0
    },
    {
      id: classRowId(P, 3, 2),
      label: 'Lay on Hands',
      description:
        'Your blessed touch can heal wounds. You have a pool of healing power that replenishes when you take a long rest. With that pool, you can restore a total number of hit points equal to your paladin level × 5.\n\nAs an action, you can touch a creature and draw power from the pool to restore a number of hit points to that creature, up to the maximum amount remaining in your pool.\n\nAlternatively, you can expend 5 hit points from your pool of healing to cure the target of one disease or neutralize one poison affecting it. You can cure multiple diseases and neutralize multiple poisons with a single use of Lay on Hands, expending hit points separately for each one.\n\nThis feature has no effect on undead and constructs.',
      attributes: [FEATURE_ATTRIBUTE.LIMITED_USE],
      // The pool is 5 hit points per paladin level; each point spent heals 1 hit point.
      charges: {
        id: classRowId(P, 0x66, 2),
        limitKind: 'CLASS_LEVEL',
        scalingKind: SCALING.NONE,
        classId: CLASS_IDS.PALADIN,
        multiplier: 5,
        resetKind: 'LONG_REST'
      },
      // Healing and curing share one touch and one filter; the cure spends 5 from the pool as a
      // fixed cost, so it chooses no amount. A disease has no condition to end yet (Lesser
      // Restoration is the same), so the cure ends the poisoned condition.
      effects: [
        {
          id: classRowId(P, 0x60, 2),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: TRIGGER.ACTIVATED,
            resourceUse: { chargeId: classRowId(P, 0x66, 2), cost: 1 },
            activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: classRowId(P, 0x69, 2), rangeKind: RANGE_KIND.TOUCH },
            targeting: LAY_ON_HANDS_TARGETING
          },
          paths: [
            {
              id: classRowId(P, 0x80, 2),
              order: 1,
              pathCode: PATH_CODE.ON_USE,
              groupType: PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: classRowId(P, 0x81, 2),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: classRowId(P, 0x82, 2),
                    effectKind: EFFECT_KIND.HEAL,
                    valueKind: 'RESOURCE_SPENT',
                    scalingKind: SCALING.NONE,
                    amount: 1
                  }
                ]
              }
            }
          ]
        },
        {
          id: classRowId(P, 0x60, 0x62),
          order: 2,
          invocation: {
            kind: 'ACTION',
            triggerCode: TRIGGER.ACTIVATED,
            resourceUse: { chargeId: classRowId(P, 0x66, 2), cost: 5 },
            activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: classRowId(P, 0x69, 0x62), rangeKind: RANGE_KIND.TOUCH },
            targeting: LAY_ON_HANDS_TARGETING
          },
          paths: [
            {
              id: classRowId(P, 0x80, 0x62),
              order: 1,
              pathCode: PATH_CODE.ON_USE,
              groupType: PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: classRowId(P, 0x81, 0x62),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: classRowId(P, 0x82, 0x62),
                    effectKind: EFFECT_KIND.END_EFFECTS,
                    scope: 'ONE_CHOSEN',
                    selectors: [{ kind: 'CONDITION', conditionIds: [conditionTypeId('POISONED')] }]
                  }
                ]
              }
            }
          ]
        }
      ],
      availableAtLevel: 1,
      order: 1
    },
    {
      id: classRowId(P, 3, 3),
      label: 'Fighting Style',
      description:
        "At 2nd level, you adopt a style of fighting as your specialty. Choose one of the following options. You can't take a Fighting Style option more than once, even if you later get to choose again.",
      availableAtLevel: 2,
      order: 2,
      optionChoices: [{ level: 2, count: 1 }],
      options: [
        {
          id: classRowId(P, 4, 1),
          label: 'Defense',
          description: 'While you are wearing armor, you gain a +1 bonus to AC.',
          grants: {
            modifiers: [
              {
                id: classRowId(P, 4, 10),
                grantKind: GRANT_KIND.MODIFIER_GRANT,
                valueDomainCode: VALUE_DOMAIN_CODE.ARMOR_CLASS,
                domain: {},
                modifierKind: MODIFIER_KIND.BONUS,
                scope: MODIFIER_SCOPE_KIND.GLOBAL,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                payload: { valueKind: 'FIXED' as const, amount: 1 },
                order: 0,
                restrictions: {
                  id: classRowId(P, 0x70, 1),
                  groups: [
                    {
                      id: classRowId(P, 0x70, 2),
                      order: 0,
                      contexts: [
                        {
                          id: classRowId(P, 0x70, 3),
                          order: 0,
                          subject: 'CHARACTER',
                          conditions: [
                            {
                              id: classRowId(P, 0x70, 4),
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
          order: 0
        },
        {
          id: classRowId(P, 4, 2),
          label: 'Dueling',
          description:
            'When you are wielding a melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.',
          grants: {
            modifiers: [
              {
                id: classRowId(P, 4, 11),
                grantKind: GRANT_KIND.MODIFIER_GRANT,
                valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
                domain: { attackDomain: 'MELEE' as const },
                modifierKind: MODIFIER_KIND.BONUS,
                scope: MODIFIER_SCOPE_KIND.GLOBAL,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                payload: { valueKind: 'FIXED' as const, amount: 2 },
                order: 0,
                restrictions: duelingRestriction((entry) => classRowId(P, 0x7a, 0x20 + entry))
              }
            ]
          },
          order: 1
        },
        {
          id: classRowId(P, 4, 3),
          label: 'Great Weapon Fighting',
          description:
            'When you roll a 1 or 2 on a damage die for an attack you make with a melee weapon that you are wielding with two hands, you can reroll the die and must use the new roll. The weapon must have the two-handed or versatile property for you to gain this benefit.',
          effects: [
            closedRuleEffect({
              id: classRowId(P, 0x60, 22),
              ruleKind: CLOSED_RULE_KIND.CLASS_PALADIN_FIGHTING_STYLE_GREAT_WEAPON,
              pathCode: PATH_CODE.ON_HIT,
              invocation: {
                kind: 'PASSIVE',
                triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
                range: { id: classRowId(P, 0x69, 22), rangeKind: RANGE_KIND.SPECIAL },
                targeting: {
                  selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                  dispositionKind: TARGET_DISPOSITION_KIND.HOSTILE
                }
              }
            })
          ],
          order: 2
        },
        {
          id: classRowId(P, 4, 4),
          label: 'Protection',
          description:
            'When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll. You must be wielding a shield.',
          effects: [
            closedRuleEffect({
              id: classRowId(P, 0x60, 23),
              ruleKind: CLOSED_RULE_KIND.CLASS_PALADIN_FIGHTING_STYLE_PROTECTION,
              invocation: {
                kind: 'ACTION',
                triggerCode: TRIGGER.ACTIVATED,
                activation: { code: ACTIVATION_CODE.REACTION, amount: 1 },
                range: {
                  id: classRowId(P, 0x69, 23),
                  rangeKind: RANGE_KIND.DISTANCE,
                  amount: 5,
                  unit: MEASUREMENT_UNIT_CODE.FEET
                },
                targeting: {
                  selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                  dispositionKind: TARGET_DISPOSITION_KIND.ANY,
                  self: 'WARN'
                }
              }
            })
          ],
          order: 3
        }
      ]
    },
    {
      id: classRowId(P, 3, 4),
      label: 'Spellcasting',
      description:
        'By 2nd level, you have learned to draw on divine magic through meditation and prayer to cast spells as a cleric does.',
      availableAtLevel: 2,
      order: 3
    },
    {
      id: classRowId(P, 3, 5),
      label: 'Divine Smite',
      description:
        "Starting at 2nd level, when you hit a creature with a melee weapon attack, you can expend one spell slot to deal radiant damage to the target, in addition to the weapon's damage. The extra damage is 2d8 for a 1st-level spell slot, plus 1d8 for each spell level higher than 1st, to a maximum of 5d8. The damage increases by 1d8 if the target is an undead or a fiend.",
      effects: [
        {
          id: classRowId(P, 0x60, 5),
          order: 1,
          invocation: smiteInvocation(5, { kind: 'SPELL_SLOT' }),
          paths: [
            smiteRadiantPath(5, 0, {
              levels: [
                [1, '2d8'],
                [2, '3d8'],
                [3, '4d8'],
                [4, '5d8']
              ]
            }),
            smiteRadiantPath(5, 1, { diceConfig: '1d8' }, undeadOrFiendTarget(5))
          ]
        }
      ],
      availableAtLevel: 2,
      order: 4
    },
    {
      id: classRowId(P, 3, 6),
      label: 'Divine Health',
      description:
        'By 3rd level, the divine magic flowing through you makes you immune to disease.',
      availableAtLevel: 3,
      order: 5
    },
    {
      id: classRowId(P, 3, 7),
      label: 'Sacred Oath',
      description:
        'When you reach 3rd level, you swear the oath that binds you as a paladin forever. Up to this time you have been in a preparatory stage, committed to the path but not yet sworn to it. Now you choose an oath, such as the Oath of Devotion.\n\nYour choice grants you features at 3rd level and again at 7th, 15th, and 20th level. Those features include oath spells and the Channel Divinity feature.',
      attributes: [FEATURE_ATTRIBUTE.SUBCLASS_SELECTION],
      availableAtLevel: 3,
      order: 6
    },
    {
      id: classRowId(P, 3, 8),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 4,
      order: 7,
      optionChoices: [{ level: 4, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(P, 5, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(40, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(P, 3, 9),
      label: 'Extra Attack',
      description:
        'Beginning at 5th level, you can attack twice, instead of once, whenever you take the Attack action on your turn.',
      grants: {
        modifiers: [attacksPerAttackActionGrant(classRowId(P, 0x6f, 1), 2)]
      },
      availableAtLevel: 5,
      order: 8
    },
    {
      id: classRowId(P, 3, 10),
      label: 'Aura of Protection',
      description:
        'Starting at 6th level, whenever you or a friendly creature within 10 feet of you must make a saving throw, the creature gains a bonus to the saving throw equal to your Charisma modifier (with a minimum bonus of +1). You must be conscious to grant this bonus.\n\nAt 18th level, the range of this aura increases to 30 feet.',
      effects: [
        {
          id: classRowId(P, 0x60, 10),
          order: 1,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.ACTIVATED,
            range: { id: classRowId(P, 0x69, 10), rangeKind: RANGE_KIND.SELF },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
              dispositionKind: TARGET_DISPOSITION_KIND.ANY
            },
            shape: paladinAuraShape(0x71, 0)
          },
          paths: [
            {
              id: classRowId(P, 0x71, 2),
              order: 1,
              pathCode: PATH_CODE.ON_USE,
              groupType: PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: classRowId(P, 0x71, 3),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: classRowId(P, 0x71, 4),
                    effectKind: EFFECT_KIND.MANIFEST,
                    manifestKind: MANIFEST_KIND.ZONE,
                    attachmentKind: 'SOURCE',
                    label: 'Aura of Protection',
                    shape: paladinAuraShape(0x71, 5),
                    components: [
                      {
                        id: classRowId(P, 0x71, 7),
                        order: 1,
                        label: 'Protective aura',
                        occupantSaveBonus: {
                          id: classRowId(P, 0x71, 8),
                          domain: 'EVERY_SAVING_THROW',
                          amountKind: 'SOURCE_ABILITY_MODIFIER',
                          ability: ABILITY_CODE.CHARISMA,
                          minimum: 1,
                          dispositionFilter: 'ALLIES_AND_SOURCE'
                        }
                      }
                    ]
                  }
                ]
              }
            }
          ]
        }
      ],
      availableAtLevel: 6,
      order: 9
    },
    {
      id: classRowId(P, 3, 11),
      label: 'Sacred Oath Feature',
      description:
        'When you reach 3rd level, you swear the oath that binds you as a paladin forever. Up to this time you have been in a preparatory stage, committed to the path but not yet sworn to it. Now you choose an oath, such as the Oath of Devotion.\n\nYour choice grants you features at 3rd level and again at 7th, 15th, and 20th level. Those features include oath spells and the Channel Divinity feature.',
      availableAtLevel: 7,
      order: 10
    },
    {
      id: classRowId(P, 3, 12),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 8,
      order: 11,
      optionChoices: [{ level: 8, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(P, 6, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(41, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(P, 3, 13),
      label: 'Aura of Courage',
      description:
        "Starting at 10th level, you and friendly creatures within 10 feet of you can't be frightened while you are conscious.\n\nAt 18th level, the range of this aura increases to 30 feet.",
      effects: [
        paladinConditionImmunityAura({
          id: classRowId(P, 0x60, 13),
          rangeId: classRowId(P, 0x69, 13),
          group: 0x72,
          label: 'Aura of Courage',
          conditionCodes: ['FRIGHTENED']
        })
      ],
      availableAtLevel: 10,
      order: 12
    },
    {
      id: classRowId(P, 3, 14),
      label: 'Improved Divine Smite',
      description:
        'By 11th level, you are so suffused with righteous might that all your melee weapon strikes carry divine power with them. Whenever you hit a creature with a melee weapon, the creature takes an extra 1d8 radiant damage. If you also use your Divine Smite with an attack, you add this damage to the extra damage of your Divine Smite.',
      effects: [
        {
          id: classRowId(P, 0x60, 14),
          order: 1,
          invocation: smiteInvocation(14),
          paths: [smiteRadiantPath(14, 0, { diceConfig: '1d8' })]
        }
      ],
      availableAtLevel: 11,
      order: 13
    },
    {
      id: classRowId(P, 3, 15),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 12,
      order: 14,
      optionChoices: [{ level: 12, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(P, 7, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(42, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(P, 3, 16),
      label: 'Cleansing Touch',
      description:
        'Beginning at 14th level, you can use your action to end one spell on yourself or on one willing creature that you touch.\n\nYou can use this feature a number of times equal to your Charisma modifier (a minimum of once). You regain expended uses when you finish a long rest.',
      attributes: [FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: classRowId(P, 0x66, 16),
        limitKind: 'ABILITY_MODIFIER',
        scalingKind: SCALING.NONE,
        resetKind: 'LONG_REST',
        ability: ABILITY_CODE.CHARISMA,
        min: 1
      },
      effects: [
        {
          id: classRowId(P, 0x60, 16),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: TRIGGER.ACTIVATED,
            resourceUse: { chargeId: classRowId(P, 0x66, 16), cost: 1 },
            activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: classRowId(P, 0x69, 16), rangeKind: RANGE_KIND.TOUCH },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: classRowId(P, 0x80, 16),
              order: 1,
              pathCode: PATH_CODE.ON_USE,
              groupType: PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: classRowId(P, 0x81, 16),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: classRowId(P, 0x82, 16),
                    effectKind: EFFECT_KIND.END_EFFECTS,
                    scope: 'ONE_CHOSEN',
                    selectors: [{ kind: 'SPELL_LEVEL', limit: 'FIXED', level: 9 }]
                  }
                ]
              }
            }
          ]
        }
      ],
      availableAtLevel: 14,
      order: 15
    },
    {
      id: classRowId(P, 3, 17),
      label: 'Sacred Oath Feature',
      description:
        'When you reach 3rd level, you swear the oath that binds you as a paladin forever. Up to this time you have been in a preparatory stage, committed to the path but not yet sworn to it. Now you choose an oath, such as the Oath of Devotion.\n\nYour choice grants you features at 3rd level and again at 7th, 15th, and 20th level. Those features include oath spells and the Channel Divinity feature.',
      availableAtLevel: 15,
      order: 16
    },
    {
      id: classRowId(P, 3, 18),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 16,
      order: 17,
      optionChoices: [{ level: 16, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(P, 8, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(43, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(P, 3, 19),
      label: 'Sacred Oath Feature',
      description:
        'When you reach 3rd level, you swear the oath that binds you as a paladin forever. Up to this time you have been in a preparatory stage, committed to the path but not yet sworn to it. Now you choose an oath, such as the Oath of Devotion.\n\nYour choice grants you features at 3rd level and again at 7th, 15th, and 20th level. Those features include oath spells and the Channel Divinity feature.',
      availableAtLevel: 20,
      order: 18
    },
    {
      id: classRowId(P, 3, 20),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 19,
      order: 19,
      optionChoices: [{ level: 19, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(P, 9, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(44, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    }
  ]
}
