import {
  ACTIVATION_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_DUPLICATE_POLICY,
  AUTHORING_SELECTION_KIND,
  CLASS_CATEGORY,
  CLOSED_RULE_KIND,
  DURATION_KIND,
  EFFECT_KIND,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  FEATURE_ATTRIBUTE,
  GRANT_KIND,
  MANUAL_ADJUDICATION_REASON,
  PATH_CODE,
  PATH_GROUP_TYPE,
  PROFICIENCY_KIND,
  RANGE_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  STARTING_EQUIPMENT_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  type ActivationCode,
  type ClassAuthored,
  type ClosedRuleKind,
  type EffectAuthored,
  type FacetAuthored,
  type ModifierGrantAuthored
} from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import { CLASS_IDS } from '../ids.js'
import {
  SRD_CURRENCIES,
  SRD_DAMAGE_TYPES,
  SRD_SKILLS,
  SRD_SPEEDS,
  SRD_SYSTEM_ID,
  SRD_USER_ID,
  ABILITY_CODE
} from '../vocabulary.js'
import {
  abilityScoreImprovementOptions,
  attacksPerAttackActionGrant,
  closedRuleEffect,
  equippedCategoryRestriction,
  gmRulingEffect
} from './mechanics.js'

function skillId(code: string): string {
  const entry = SRD_SKILLS.find((s) => s.code === code)
  if (!entry) throw new Error(`SRD skill vocabulary entry for ${code} required.`)
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

const B = 1 // Barbarian class index

/** Rage's authored effect id, which features that work "while raging" require active. */
export const RAGE_EFFECT_ID = classRowId(B, 0x60, 1)

const abilityScoreImprovementDescription =
  "When you reach 4th level, and again at 8th, 12th, 16th, and 19th level, you can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1. As normal, you can't increase an ability score above 20 using this feature."

const GREATAXE_ID = equipmentId(18)
const HANDAXE_ID = equipmentId(4)
const JAVELIN_ID = equipmentId(5)
const EXPLORERS_PACK_ID = equipmentId(186)

const walkSpeedId = SRD_SPEEDS.find((speed) => speed.code === 'WALK')?.id
if (!walkSpeedId) throw new Error('SRD walk speed required.')

function selfClassRuleEffect(
  entry: number,
  ruleKind: ClosedRuleKind,
  activationCode?: Exclude<ActivationCode, 'FREE'>,
  resourceChargeId?: string
): EffectAuthored {
  const range = { id: classRowId(B, 0x69, entry), rangeKind: RANGE_KIND.SELF } as const
  return closedRuleEffect({
    id: classRowId(B, 0x60, entry),
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

/**
 * Danger Sense: advantage on Dexterity saves against effects the holder can see, lost while the
 * holder can't act. The Scene decides the sight (`requiresHolderSeesSource` on the grant); this is
 * the holder-state restriction.
 */
function dangerSenseRestriction(): FacetAuthored {
  const id = (entry: number) => classRowId(B, 0x88, entry)
  return {
    id: id(0),
    groups: [
      {
        id: id(1),
        order: 0,
        contexts: [
          {
            id: id(2),
            order: 0,
            subject: 'CHARACTER',
            conditions: [
              {
                id: id(3),
                order: 0,
                kind: 'PREDICATE',
                constraint: 'INCLUDE',
                predicateCode: 'CAN_ACT'
              }
            ]
          }
        ]
      }
    ]
  }
}

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

/** The Rage Damage column of the Barbarian table, by class level band. */
const RAGE_DAMAGE_BANDS: readonly { amount: number; min: number; max?: number }[] = [
  { amount: 2, min: 1, max: 8 },
  { amount: 3, min: 9, max: 15 },
  { amount: 4, min: 16 }
]

/** Rage's benefits hold only while the holder wears no heavy armor. */
const heavyArmorExclusion = (id: string, order: number) => ({
  id,
  order,
  kind: 'PREDICATE' as const,
  constraint: 'EXCLUDE' as const,
  predicateCode: 'EQUIPMENT_EQUIPPED' as const,
  authoringModeKind: 'ALL' as const,
  category: EQUIPMENT_CATEGORY_CODE.ARMOR,
  properties: [EQUIPMENT_PROPERTY_CODE.HEAVY]
})

/** A benefit that holds only while the holder wears no heavy armor (Rage's, Fast Movement). */
function noHeavyArmorRestriction(index: number): FacetAuthored {
  const id = (entry: number) => classRowId(B, 0x86, index * 8 + entry)
  return {
    id: id(0),
    groups: [
      {
        id: id(1),
        order: 0,
        contexts: [
          {
            id: id(2),
            order: 0,
            subject: 'CHARACTER',
            conditions: [heavyArmorExclusion(id(3), 0)]
          }
        ]
      }
    ]
  }
}

/** Brutal Critical's levels: each adds one more weapon damage die on a melee critical hit. */
const BRUTAL_CRITICAL_LEVELS = [9, 13, 17] as const

/** One extra damage die per level reached, so the three grants add to one, two, then three dice. */
function brutalCriticalGrants(): ModifierGrantAuthored[] {
  return BRUTAL_CRITICAL_LEVELS.map((min, index) => {
    const id = (entry: number) => classRowId(B, 0x86, index * 8 + entry)
    return {
      id: classRowId(B, 0x85, 0x40 + index),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.CRITICAL_EXTRA_DICE,
      domain: { attackDomain: 'MELEE' },
      modifierKind: MODIFIER_KIND.BONUS,
      scope: MODIFIER_SCOPE_KIND.GLOBAL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { valueKind: 'FIXED', amount: 1 },
      order: index,
      restrictions: {
        id: id(0),
        groups: [
          {
            id: id(1),
            order: 0,
            contexts: [
              {
                id: id(2),
                order: 0,
                subject: 'CHARACTER',
                conditions: [
                  {
                    id: id(3),
                    order: 0,
                    kind: 'PREDICATE',
                    constraint: 'INCLUDE',
                    predicateCode: 'CLASS_LEVEL',
                    classIds: [CLASS_IDS.BARBARIAN],
                    min
                  }
                ]
              }
            ]
          }
        ]
      }
    }
  })
}

/**
 * Rage damage applies to the attack when the holder is in that level band, wears no heavy armor
 * and attacked with Strength.
 */
function rageDamageRestriction(
  { min, max }: (typeof RAGE_DAMAGE_BANDS)[number],
  band: number
): FacetAuthored {
  const id = (entry: number) => classRowId(B, 0x85, band * 8 + entry)
  return {
    id: id(0),
    groups: [
      {
        id: id(1),
        order: 0,
        contexts: [
          {
            id: id(2),
            order: 0,
            subject: 'CHARACTER',
            conditions: [
              {
                id: id(3),
                order: 0,
                kind: 'PREDICATE',
                constraint: 'INCLUDE',
                predicateCode: 'CLASS_LEVEL',
                classIds: [CLASS_IDS.BARBARIAN],
                min,
                ...(max === undefined ? {} : { max })
              },
              heavyArmorExclusion(id(6), 1)
            ]
          },
          {
            id: id(4),
            order: 1,
            subject: 'EQUIPMENT',
            authoringModeKind: 'ALL',
            conditions: [
              {
                id: id(5),
                order: 0,
                kind: 'PREDICATE',
                constraint: 'INCLUDE',
                predicateCode: 'ATTACK_ABILITY',
                ability: ABILITY_CODE.STRENGTH
              }
            ]
          }
        ]
      }
    ]
  }
}

function rageDamageTypeId(code: string): string {
  const entry = SRD_DAMAGE_TYPES.find((damageType) => damageType.code === code)
  if (!entry) throw new Error(`SRD damage type vocabulary entry for ${code} required.`)
  return entry.id
}

/**
 * Rage: a bonus action that spends one Rage charge and grants the rage for 1 minute. The holder or
 * the GM can end it and being knocked unconscious ends it; the grant carries the benefits and the spellcasting
 * lock.
 */
function rageEffect(): EffectAuthored {
  const grantShape = {
    grantKind: GRANT_KIND.MODIFIER_GRANT,
    scope: MODIFIER_SCOPE_KIND.GLOBAL,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED
  } as const
  const damageBonuses = RAGE_DAMAGE_BANDS.map((band, index): ModifierGrantAuthored => ({
    ...grantShape,
    id: classRowId(B, 0x84, index + 1),
    valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
    domain: { attackDomain: 'MELEE' },
    modifierKind: MODIFIER_KIND.BONUS,
    payload: { valueKind: 'FIXED', amount: band.amount },
    order: index,
    restrictions: rageDamageRestriction(band, index)
  }))
  const resistances = ['BLUDGEONING', 'PIERCING', 'SLASHING'].map(
    (code, index): ModifierGrantAuthored => ({
      ...grantShape,
      id: classRowId(B, 0x84, 4 + index),
      valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE_RESISTANCE,
      domain: {},
      modifierKind: MODIFIER_KIND.ADD_OPTION,
      payload: { damageTypeId: rageDamageTypeId(code) },
      order: 3 + index,
      restrictions: noHeavyArmorRestriction(index)
    })
  )
  const strengthAdvantages: ModifierGrantAuthored[] = [
    {
      ...grantShape,
      id: classRowId(B, 0x84, 7),
      valueDomainCode: VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
      domain: { ability: ABILITY_CODE.STRENGTH },
      modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
      payload: { influence: 'ADVANTAGE' },
      order: 6,
      restrictions: noHeavyArmorRestriction(3)
    },
    {
      ...grantShape,
      id: classRowId(B, 0x84, 8),
      valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_CHECK,
      domain: { ability: ABILITY_CODE.STRENGTH },
      modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
      payload: { influence: 'ADVANTAGE' },
      order: 7,
      restrictions: noHeavyArmorRestriction(4)
    }
  ]
  const spellcastingLock: ModifierGrantAuthored = {
    ...grantShape,
    id: classRowId(B, 0x84, 9),
    valueDomainCode: VALUE_DOMAIN_CODE.SPELLCASTING_LOCK,
    domain: {},
    modifierKind: MODIFIER_KIND.ENABLE,
    order: 8
  }
  return {
    id: RAGE_EFFECT_ID,
    order: 1,
    invocation: {
      kind: 'ACTION',
      triggerCode: TRIGGER.ACTIVATED,
      resourceUse: { chargeId: rageCharge.id, cost: 1 },
      activation: { code: ACTIVATION_CODE.BONUS_ACTION, amount: 1 },
      range: { id: classRowId(B, 0x69, 1), rangeKind: RANGE_KIND.SELF },
      targeting: { selectionKind: 'SELF' }
    },
    paths: [
      {
        id: classRowId(B, 0x80, 1),
        order: 1,
        pathCode: PATH_CODE.ON_USE,
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: {
          id: classRowId(B, 0x81, 1),
          resultKind: 'SINGLE',
          duration: { id: classRowId(B, 0x83, 1), durationKind: DURATION_KIND.MINUTE, amount: 1 },
          lifecycle: {
            endTriggers: [
              { event: 'LIFECYCLE' as const, timing: 'END' as const, code: 'ON_IDLE_TURN' }
            ],
            endOnConditionIds: [conditionTypeId('UNCONSCIOUS')],
            holderEnd: { activation: 'BONUS_ACTION' }
          },
          outcomes: [
            {
              id: classRowId(B, 0x82, 1),
              effectKind: EFFECT_KIND.APPLY_GRANT,
              grants: {
                modifiers: [
                  ...damageBonuses,
                  ...resistances,
                  ...strengthAdvantages,
                  spellcastingLock
                ]
              }
            }
          ]
        }
      }
    ]
  }
}

export const barbarian: ClassAuthored = {
  id: CLASS_IDS.BARBARIAN,
  label: 'Barbarian',
  category: CLASS_CATEGORY.BASE,
  subclassSelectionLevel: 3,
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,

  hitpoint: {
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
        proficiencyKind: PROFICIENCY_KIND.EQUIPMENT,
        level: SCALING_AMOUNT_KIND.FULL,
        selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
        scalingKind: SCALING.NONE,
        authoringModeKind: AUTHORING_MODE_KIND.ALL,
        category: 'SHIELD',
        order: 0
      }
    ]
  },

  startingEquipment: {
    id: classRowId(B, 98, 1),
    sets: [
      {
        id: classRowId(B, 98, 2),
        order: 0,
        groups: [
          {
            id: classRowId(B, 98, 3),
            order: 0,
            options: [
              {
                id: classRowId(B, 98, 4),
                order: 0,
                items: [
                  {
                    id: classRowId(B, 98, 5),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [GREATAXE_ID],
                    quantity: 1
                  }
                ]
              },
              {
                id: classRowId(B, 98, 6),
                order: 1,
                items: [
                  {
                    id: classRowId(B, 98, 7),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
                    authoringModeKind: AUTHORING_MODE_KIND.ALL,
                    category: EQUIPMENT_CATEGORY_CODE.WEAPON,
                    properties: [EQUIPMENT_PROPERTY_CODE.MARTIAL, EQUIPMENT_PROPERTY_CODE.MELEE],
                    count: 1
                  }
                ]
              }
            ]
          },
          {
            id: classRowId(B, 98, 8),
            order: 1,
            options: [
              {
                id: classRowId(B, 98, 9),
                order: 0,
                items: [
                  {
                    id: classRowId(B, 98, 10),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [HANDAXE_ID],
                    quantity: 2
                  }
                ]
              },
              {
                id: classRowId(B, 98, 11),
                order: 1,
                items: [
                  {
                    id: classRowId(B, 98, 12),
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
            id: classRowId(B, 98, 13),
            order: 2,
            options: [
              {
                id: classRowId(B, 98, 14),
                order: 0,
                items: [
                  {
                    id: classRowId(B, 98, 15),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [EXPLORERS_PACK_ID],
                    quantity: 1
                  },
                  {
                    id: classRowId(B, 98, 16),
                    order: 1,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [JAVELIN_ID],
                    quantity: 4
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
      selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
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
    order: 0,
    id: classRowId(B, 5, 1),
    label: 'Rage',
    availableAtLevel: 1,
    charges: rageCharge
  },

  features: [
    {
      id: classRowId(B, 3, 1),
      label: 'Rage',
      description:
        "In battle, you fight with primal ferocity. On your turn, you can enter a rage as a bonus action.\n\nWhile raging, you gain the following benefits if you aren't wearing heavy armor:\n\n* You have advantage on Strength checks and Strength saving throws.\n* When you make a melee weapon attack using Strength, you gain a bonus to the damage roll that increases as you gain levels as a barbarian, as shown in the Rage Damage column of the Barbarian table.\n* You have resistance to bludgeoning, piercing, and slashing damage.\n\nIf you are able to cast spells, you can't cast them or concentrate on them while raging.\n\nYour rage lasts for 1 minute. It ends early if you are knocked unconscious or if your turn ends and you haven't attacked a hostile creature since your last turn or taken damage since then. You can also end your rage on your turn as a bonus action.\n\nOnce you have raged the number of times shown for your barbarian level in the Rages column of the Barbarian table, you must finish a long rest before you can rage again.",
      effects: [rageEffect()],
      availableAtLevel: 1,
      order: 0
    },
    {
      id: classRowId(B, 3, 2),
      label: 'Unarmored Defense',
      description:
        'While you are not wearing any armor, your Armor Class equals 10 + your Dexterity modifier + your Constitution modifier. You can use a shield and still gain this benefit.',
      availableAtLevel: 1,
      order: 1,
      grants: {
        modifiers: [
          {
            id: classRowId(B, 3, 3),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ARMOR_CLASS,
            domain: {},
            modifierKind: MODIFIER_KIND.SET_VALUE,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: {
              amount: 10,
              abilities: [ABILITY_CODE.DEXTERITY, ABILITY_CODE.CONSTITUTION]
            },
            order: 0,
            // An alternative armor class formula without armor; a shield still adds.
            restrictions: equippedCategoryRestriction(
              (entry) => classRowId(B, 0x7a, 0x10 + entry),
              'EXCLUDE',
              [EQUIPMENT_CATEGORY_CODE.ARMOR]
            )
          }
        ]
      }
    },
    {
      id: classRowId(B, 3, 4),
      label: 'Reckless Attack',
      description:
        'Starting at 2nd level, you can throw aside all concern for defense to attack with fierce desperation. When you make your first attack on your turn, you can decide to attack recklessly. Doing so gives you advantage on melee weapon attack rolls using Strength during this turn, but attack rolls against you have advantage until your next turn.',
      // Its two grants end on different turn boundaries, which one fixed self action cannot hold, so it is a GM ruling (D187a).
      effects: [
        gmRulingEffect({
          ids: {
            effect: classRowId(B, 0x60, 4),
            range: classRowId(B, 0x69, 4),
            path: classRowId(B, 0x90, 1),
            result: classRowId(B, 0x91, 1),
            outcome: classRowId(B, 0x94, 1)
          },
          label: 'Reckless Attack',
          instructions:
            'When you make your first attack on your turn, you can attack recklessly. You then have advantage on melee weapon attack rolls using Strength this turn, and attack rolls against you have advantage until the start of your next turn. The GM applies both.',
          reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE
        })
      ],
      availableAtLevel: 2,
      order: 2
    },
    {
      id: classRowId(B, 3, 5),
      label: 'Danger Sense',
      description:
        "At 2nd level, you gain an uncanny sense of when things nearby aren't as they should be, giving you an edge when you dodge away from danger. You have advantage on Dexterity saving throws against effects that you can see, such as traps and spells. To gain this benefit, you can't be blinded, deafened, or incapacitated.",
      grants: {
        modifiers: [
          {
            id: classRowId(B, 0x87, 1),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
            domain: { ability: ABILITY_CODE.DEXTERITY, requiresHolderSeesSource: true },
            modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
            payload: { influence: 'ADVANTAGE' },
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            order: 0,
            restrictions: dangerSenseRestriction()
          }
        ]
      },
      availableAtLevel: 2,
      order: 3
    },
    {
      id: classRowId(B, 3, 6),
      label: 'Primal Path',
      description:
        'At 3rd level, you choose a path that shapes the nature of your rage. Choose the Path of the Berserker or the Path of the Totem Warrior, both detailed at the end of the class description. Your choice grants you features at 3rd level and again at 6th, 10th, and 14th levels.',
      attributes: [FEATURE_ATTRIBUTE.SUBCLASS_SELECTION],
      availableAtLevel: 3,
      order: 4
    },
    {
      id: classRowId(B, 3, 7),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 4,
      order: 5,
      optionChoices: [{ level: 4, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(B, 7, entry),
        abilityScoreImprovementDescription
      ),
      effects: [selfClassRuleEffect(7, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)]
    },
    {
      id: classRowId(B, 3, 8),
      label: 'Extra Attack',
      description:
        'Beginning at 5th level, you can attack twice, instead of once, whenever you take the Attack action on your turn.',
      grants: {
        modifiers: [attacksPerAttackActionGrant(classRowId(B, 0x6f, 1), 2)]
      },
      availableAtLevel: 5,
      order: 6
    },
    {
      id: classRowId(B, 3, 9),
      label: 'Fast Movement',
      description:
        "Starting at 5th level, your speed increases by 10 feet while you aren't wearing heavy armor.",
      availableAtLevel: 5,
      order: 7,
      grants: {
        modifiers: [
          {
            id: classRowId(B, 0x89, 1),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.SPEED,
            domain: { speedId: walkSpeedId },
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { amount: 10, unit: 'FEET' },
            order: 0,
            restrictions: noHeavyArmorRestriction(5)
          }
        ]
      }
    },
    {
      id: classRowId(B, 3, 10),
      label: 'Feral Instinct',
      description:
        "By 7th level, your instincts are so honed that you have advantage on initiative rolls. Additionally, if you are surprised at the beginning of combat and aren't incapacitated, you can act normally on your first turn, but only if you enter your rage before doing anything else on that turn.",
      availableAtLevel: 7,
      order: 8,
      grants: {
        modifiers: [
          {
            id: classRowId(B, 0x6a, 1),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.INITIATIVE,
            domain: {},
            modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
            payload: { influence: 'ADVANTAGE' },
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            order: 0
          }
        ]
      }
    },
    {
      id: classRowId(B, 3, 11),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 8,
      order: 9,
      optionChoices: [{ level: 8, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(B, 8, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(11, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(B, 3, 12),
      label: 'Brutal Critical',
      description:
        'Beginning at 9th level, you can roll one additional weapon damage die when determining the extra damage for a critical hit with a melee attack. This increases to two additional dice at 13th level and three additional dice at 17th level.',
      grants: { modifiers: brutalCriticalGrants() },
      availableAtLevel: 9,
      order: 10
    },
    {
      id: classRowId(B, 3, 13),
      label: 'Primal Path Feature',
      description:
        'At 3rd level, you choose a path that shapes the nature of your rage. Choose the Path of the Berserker or the Path of the Totem Warrior, both detailed at the end of the class description. Your choice grants you features at 3rd level and again at 6th, 10th, and 14th levels.',
      availableAtLevel: 10,
      order: 11
    },
    {
      id: classRowId(B, 3, 14),
      label: 'Relentless Rage',
      description:
        "Starting at 11th level, your rage can keep you fighting despite grievous wounds. If you drop to 0 hit points while you're raging and don't die outright, you can make a DC 10 Constitution saving throw. If you succeed, you drop to 1 hit point instead. Each time you use this feature after the first, the DC increases by 5. When you finish a short or long rest, the DC resets to 10.",
      // Each use raises the DC by 5 until a rest returns the uses; six bound it past any roll.
      charges: {
        id: classRowId(B, 0xb0, 1),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: SCALING.NONE,
        resetKind: 'SHORT_REST',
        amount: 6
      },
      grants: {
        modifiers: [
          {
            id: classRowId(B, 0xb0, 2),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE_INTERCEPTION,
            domain: {},
            modifierKind: MODIFIER_KIND.ENABLE,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: {
              dropToHitPoints: 1,
              negatesKill: false,
              save: {
                ability: 'CONSTITUTION',
                dc: { base: 10, plusDamageTaken: false, plusPerChargeUsed: 5 },
                spendsUseOnFailure: true
              }
            },
            order: 0,
            restrictions: {
              id: classRowId(B, 0xb1, 0),
              groups: [
                {
                  id: classRowId(B, 0xb1, 1),
                  order: 0,
                  contexts: [
                    {
                      id: classRowId(B, 0xb1, 2),
                      order: 0,
                      subject: 'CHARACTER',
                      conditions: [
                        {
                          id: classRowId(B, 0xb1, 3),
                          order: 0,
                          kind: 'PREDICATE',
                          constraint: 'INCLUDE',
                          predicateCode: 'HOLDER_ACTIVE_EFFECT',
                          effectIds: [RAGE_EFFECT_ID]
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
      availableAtLevel: 11,
      order: 12
    },
    {
      id: classRowId(B, 3, 15),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 12,
      order: 13,
      optionChoices: [{ level: 12, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(B, 9, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(15, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(B, 3, 16),
      label: 'Primal Path Feature',
      description:
        'At 3rd level, you choose a path that shapes the nature of your rage. Choose the Path of the Berserker or the Path of the Totem Warrior, both detailed at the end of the class description. Your choice grants you features at 3rd level and again at 6th, 10th, and 14th levels.',
      availableAtLevel: 14,
      order: 14
    },
    {
      id: classRowId(B, 3, 17),
      label: 'Persistent Rage',
      description:
        'Beginning at 15th level, your rage is so fierce that it ends early only if you fall unconscious or if you choose to end it.',
      grants: {
        modifiers: [
          {
            id: classRowId(B, 0xb2, 1),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.END_EVENT_EXEMPTION,
            domain: {},
            modifierKind: MODIFIER_KIND.ENABLE,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            // Rage still ends when the holder falls unconscious or chooses to end it.
            payload: { events: ['ON_IDLE_TURN'], effectIds: [RAGE_EFFECT_ID] },
            order: 0
          }
        ]
      },
      availableAtLevel: 15,
      order: 15
    },
    {
      id: classRowId(B, 3, 18),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 16,
      order: 16,
      optionChoices: [{ level: 16, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(B, 10, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(18, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(B, 3, 19),
      label: 'Indomitable Might',
      description:
        'Beginning at 18th level, if your total for a Strength check is less than your Strength score, you can use that score in place of the total.',
      availableAtLevel: 18,
      order: 17
    },
    {
      id: classRowId(B, 3, 20),
      label: 'Ability Score Improvement',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: abilityScoreImprovementDescription,
      availableAtLevel: 19,
      order: 18,
      optionChoices: [{ level: 19, count: 1 }],
      options: abilityScoreImprovementOptions(
        (entry) => classRowId(B, 11, entry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(20, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(B, 3, 21),
      label: 'Primal Champion',
      description:
        'At 20th level, you embody the power of the wilds. Your Strength and Constitution scores increase by 4. Your maximum for those scores is now 24.',
      effects: [
        selfClassRuleEffect(21, CLOSED_RULE_KIND.CLASS_BARBARIAN_PRIMAL_CHAMPION_MAXIMUM_24)
      ],
      availableAtLevel: 20,
      order: 19,
      grants: {
        modifiers: [
          {
            id: classRowId(B, 0x6a, 2),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.STRENGTH },
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'FIXED', amount: 4 },
            order: 0
          },
          {
            id: classRowId(B, 0x6a, 3),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.CONSTITUTION },
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'FIXED', amount: 4 },
            order: 1
          }
        ]
      }
    }
  ]
}
