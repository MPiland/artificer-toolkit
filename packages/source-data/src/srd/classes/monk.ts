import {
  SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS,
  ABILITY_CODE
} from '../vocabulary.js'
import {
  ACTIVATION_CODE,
  ATTACK_DOMAIN_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_DUPLICATE_POLICY,
  AUTHORING_SELECTION_KIND,
  CLASS_ATTRIBUTE,
  CLASS_CATEGORY,
  CLOSED_RULE_KIND,
  DAMAGE_DEFENSE_BYPASS_CODE,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  EFFECT_KIND,
  FEATURE_ATTRIBUTE,
  GRANT_KIND,
  MANUAL_ADJUDICATION_REASON,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  PROFICIENCY_KIND,
  RANGE_KIND,
  SAVING_THROW_DC_METHOD,
  SCALING,
  SCALING_AMOUNT_KIND,
  STARTING_EQUIPMENT_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  type ActivationCode,
  type ClassAuthored,
  type ClosedRuleKind,
  type EffectAuthored,
  type ModifierGrantAuthored
} from '@artificer-toolkit/shared'
import { conditionTypeId, damageTypeId } from '../equipment/shared.js'
import { CLASS_IDS } from '../ids.js'
import {
  SRD_CURRENCIES,
  SRD_DAMAGE_TYPES,
  SRD_SKILLS,
  SRD_SPEEDS,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from '../vocabulary.js'
import {
  abilityScoreImprovementOptions,
  ARTISAN_TOOL_EQUIPMENT_INDEXES,
  attacksPerAttackActionGrant,
  closedRuleEffect,
  equippedCategoryRestriction,
  evasionGrant,
  MUSICAL_INSTRUMENT_EQUIPMENT_INDEXES
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

const M = 6 // Monk class index
const abilityScoreImprovementDescription =
  "When you reach 4th level, and again at 8th, 12th, 16th, and 19th level, you can increase one ability score of your choice by 2, or you can increase two ability scores of your choice by 1. As normal, you can't increase an ability score above 20 using this feature."

function selfClassRuleEffect(
  entry: number,
  ruleKind: ClosedRuleKind,
  activationCode?: Exclude<ActivationCode, 'FREE'>
): EffectAuthored {
  const range = { id: classRowId(M, 0x69, entry), rangeKind: RANGE_KIND.SELF } as const
  return closedRuleEffect({
    id: classRowId(M, 0x60, entry),
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

const walkSpeedId = SRD_SPEEDS.find((speed) => speed.code === 'WALK')?.id
if (!walkSpeedId) throw new Error('SRD walk speed required.')

/**
 * Unarmored Movement: the Monk table's walking speed bonus for each band of monk levels, while
 * wearing no armor and wielding no shield. Grants use bucket 0x7b; each band's restriction uses
 * bucket 0x7c + band.
 */
const unarmoredMovementModifiers: ModifierGrantAuthored[] = [
  { amount: 10, min: 2, max: 5 },
  { amount: 15, min: 6, max: 9 },
  { amount: 20, min: 10, max: 13 },
  { amount: 25, min: 14, max: 17 },
  { amount: 30, min: 18 }
].map(({ amount, min, max }, band) => {
  const restrictionId = (entry: number) => classRowId(M, 0x7c + band, entry)
  return {
    id: classRowId(M, 0x7b, band + 1),
    grantKind: GRANT_KIND.MODIFIER_GRANT,
    valueDomainCode: VALUE_DOMAIN_CODE.SPEED,
    domain: { speedId: walkSpeedId },
    modifierKind: MODIFIER_KIND.BONUS,
    scope: MODIFIER_SCOPE_KIND.GLOBAL,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    payload: { amount, unit: 'FEET' },
    order: band,
    restrictions: {
      id: restrictionId(0),
      groups: [
        {
          id: restrictionId(1),
          order: 0,
          contexts: [
            {
              id: restrictionId(2),
              order: 0,
              subject: 'CHARACTER',
              conditions: [
                ...[EQUIPMENT_CATEGORY_CODE.ARMOR, EQUIPMENT_CATEGORY_CODE.SHIELD].map(
                  (category, index) => ({
                    id: restrictionId(3 + index),
                    order: index,
                    kind: 'PREDICATE' as const,
                    constraint: 'EXCLUDE' as const,
                    predicateCode: 'EQUIPMENT_EQUIPPED' as const,
                    authoringModeKind: 'ALL' as const,
                    category
                  })
                ),
                {
                  id: restrictionId(5),
                  order: 2,
                  kind: 'PREDICATE' as const,
                  constraint: 'INCLUDE' as const,
                  predicateCode: 'CLASS_LEVEL' as const,
                  classIds: [CLASS_IDS.MONK],
                  min,
                  ...(max === undefined ? {} : { max })
                }
              ]
            }
          ]
        }
      ]
    }
  }
})

// Ki resource charge — resets on short or long rest
const kiCharge = {
  id: classRowId(M, 1, 1),
  limitKind: 'CLASS_LEVEL' as const,
  scalingKind: SCALING.NONE,
  classId: CLASS_IDS.MONK,
  resetKind: 'SHORT_REST' as const
}

export const monk: ClassAuthored = {
  id: CLASS_IDS.MONK,
  label: 'Monk',
  category: CLASS_CATEGORY.BASE,
  subclassSelectionLevel: 3,
  attributes: [CLASS_ATTRIBUTE.RESOURCE],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,

  hitpoint: {
    ability: ABILITY_CODE.CONSTITUTION,
    dieConfig: 'd8'
  },

  startingGold: {
    multiplier: 10,
    currencyId: goldCurrencyId,
    dieConfig: '5d4'
  },

  multiclass: {
    id: classRowId(M, 99, 1),
    requirementGroups: {
      groups: [
        {
          id: classRowId(M, 99, 2),
          requirements: [
            { id: classRowId(M, 99, 3), ability: ABILITY_CODE.DEXTERITY, min: 13 },
            { id: classRowId(M, 99, 4), ability: ABILITY_CODE.WISDOM, min: 13 }
          ]
        }
      ]
    },
    proficiencies: [
      // Simple weapons
      {
        id: classRowId(M, 99, 5),
        grantKind: GRANT_KIND.PROFICIENCY_GRANT,
        proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
        level: SCALING_AMOUNT_KIND.FULL,
        selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
        scalingKind: SCALING.NONE,
        authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
        properties: ['SIMPLE'],
        category: 'WEAPON',
        order: 0
      },
      // Shortswords
      {
        id: classRowId(M, 99, 6),
        grantKind: GRANT_KIND.PROFICIENCY_GRANT,
        proficiencyKind: PROFICIENCY_KIND.EQUIPMENT,
        level: SCALING_AMOUNT_KIND.FULL,
        selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
        scalingKind: SCALING.NONE,
        authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
        equipmentIds: [equipmentId(28)],
        order: 1
      }
    ]
  },

  startingEquipment: {
    id: classRowId(M, 98, 1),
    sets: [
      {
        id: classRowId(M, 98, 2),
        order: 0,
        groups: [
          {
            id: classRowId(M, 98, 3),
            order: 0,
            options: [
              {
                id: classRowId(M, 98, 4),
                order: 0,
                items: [
                  {
                    id: classRowId(M, 98, 5),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(28)],
                    quantity: 1
                  }
                ]
              },
              {
                id: classRowId(M, 98, 6),
                order: 1,
                items: [
                  {
                    id: classRowId(M, 98, 7),
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
            id: classRowId(M, 98, 8),
            order: 1,
            options: [
              {
                id: classRowId(M, 98, 9),
                order: 0,
                items: [
                  {
                    id: classRowId(M, 98, 10),
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
                id: classRowId(M, 98, 11),
                order: 1,
                items: [
                  {
                    id: classRowId(M, 98, 12),
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
            id: classRowId(M, 98, 13),
            order: 2,
            options: [
              {
                id: classRowId(M, 98, 14),
                order: 0,
                items: [
                  {
                    id: classRowId(M, 98, 15),
                    order: 0,
                    startingEquipmentKind: STARTING_EQUIPMENT_KIND.EQUIPMENT,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                    equipmentIds: [equipmentId(12)],
                    quantity: 10
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
    // Simple weapons
    {
      id: classRowId(M, 2, 1),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT_PROPERTY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      properties: ['SIMPLE'],
      category: 'WEAPON',
      order: 0
    },
    // Saving throws: STR, DEX
    {
      id: classRowId(M, 2, 2),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SAVE_ABILITY,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      abilities: [ABILITY_CODE.STRENGTH, ABILITY_CODE.DEXTERITY],
      order: 1
    },
    // Skills: choose 2 from Acrobatics, Athletics, History, Insight, Religion, Stealth
    {
      id: classRowId(M, 2, 3),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SKILL,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
      scalingKind: SCALING.NONE,
      count: 2,
      selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      skillIds: [
        skillId('ACROBATICS'),
        skillId('ATHLETICS'),
        skillId('HISTORY'),
        skillId('INSIGHT'),
        skillId('RELIGION'),
        skillId('STEALTH')
      ],
      order: 2
    },
    // Weapons: shortswords
    {
      id: classRowId(M, 2, 4),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      equipmentIds: [equipmentId(28)],
      order: 3
    },
    // Tools: one type of artisan's tools or one musical instrument
    {
      id: classRowId(M, 2, 5),
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT,
      level: SCALING_AMOUNT_KIND.FULL,
      selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
      scalingKind: SCALING.NONE,
      count: 1,
      selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      equipmentIds: [
        ...ARTISAN_TOOL_EQUIPMENT_INDEXES,
        ...MUSICAL_INSTRUMENT_EQUIPMENT_INDEXES
      ].map(equipmentId),
      order: 4
    }
  ],

  resources: {
    order: 0,
    id: classRowId(M, 5, 1),
    label: 'Ki',
    availableAtLevel: 2,
    charges: kiCharge
  },

  features: [
    {
      id: classRowId(M, 3, 1),
      label: 'Unarmored Defense',
      description:
        'Beginning at 1st level, while you are wearing no armor and not wielding a shield, your AC equals 10 + your Dexterity modifier + your Wisdom modifier.',
      availableAtLevel: 1,
      order: 0,
      grants: {
        modifiers: [
          {
            id: classRowId(M, 0x7a, 1),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ARMOR_CLASS,
            domain: {},
            modifierKind: MODIFIER_KIND.SET_VALUE,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { amount: 10, abilities: [ABILITY_CODE.DEXTERITY, ABILITY_CODE.WISDOM] },
            order: 0,
            // An alternative armor class formula; unlike the barbarian's, a shield ends it.
            restrictions: equippedCategoryRestriction(
              (entry) => classRowId(M, 0x7a, 0x10 + entry),
              'EXCLUDE',
              [EQUIPMENT_CATEGORY_CODE.ARMOR, EQUIPMENT_CATEGORY_CODE.SHIELD]
            )
          }
        ]
      }
    },
    {
      id: classRowId(M, 3, 2),
      label: 'Martial Arts',
      description:
        "At 1st level, your practice of martial arts gives you mastery of combat styles that use unarmed strikes and monk weapons, which are shortswords and any simple melee weapons that don't have the two-handed or heavy property. You gain the following benefits while you are unarmed or wielding only monk weapons and you aren't wearing armor or wielding a shield: * You can use Dexterity instead of Strength for the attack and damage rolls of your unarmed strikes and monk weapons. * You can roll a d4 in place of the normal damage of your unarmed strike or monk weapon. This die changes as you gain monk levels, as shown in the Martial Arts column of the Monk table. * When you use the Attack action with an unarmed strike or a monk weapon on your turn, you can make one unarmed strike as a bonus action. For example, if you take the Attack action and attack with a quarterstaff, you can also make an unarmed strike as a bonus action, assuming you haven't already taken a bonus action this turn. Certain monasteries use specialized forms of the monk weapons. For example, you might use a club that is two lengths of wood connected by a short chain (called a nunchaku) or a sickle with a shorter, straighter blade (called a kama). Whatever name you use for a monk weapon, you can use the game statistics provided for the weapon.",
      availableAtLevel: 1,
      order: 1,
      effects: [
        closedRuleEffect({
          id: classRowId(M, 0x60, 2),
          ruleKind: CLOSED_RULE_KIND.CLASS_MONK_MARTIAL_ARTS,
          pathCode: PATH_CODE.ON_ATTACK,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
            range: { id: classRowId(M, 0x69, 2), rangeKind: RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: 'HOSTILE'
            }
          }
        }),
        closedRuleEffect({
          id: classRowId(M, 0x70, 2),
          ruleKind: CLOSED_RULE_KIND.CLASS_MONK_MARTIAL_ARTS,
          pathCode: PATH_CODE.ON_ATTACK,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.UNARMED_ATTACK,
            range: { id: classRowId(M, 0x71, 2), rangeKind: RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: 'HOSTILE'
            }
          }
        }),
        closedRuleEffect({
          id: classRowId(M, 0x72, 2),
          ruleKind: CLOSED_RULE_KIND.CLASS_MONK_MARTIAL_ARTS,
          pathCode: PATH_CODE.ON_ATTACK,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.RANGED_WEAPON_ATTACK,
            range: { id: classRowId(M, 0x73, 2), rangeKind: RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: 'HOSTILE'
            }
          }
        })
      ]
    },
    {
      id: classRowId(M, 3, 3),
      label: 'Ki',
      description:
        "Starting at 2nd level, your training allows you to harness the mystic energy of ki. Your access to this energy is represented by a number of ki points. Your monk level determines the number of points you have, as shown in the Ki Points column of the Monk table. You can spend these points to fuel various ki features. You start knowing three such features: Flurry of Blows, Patient Defense, and Step of the Wind. You learn more ki features as you gain levels in this class. When you spend a ki point, it is unavailable until you finish a short or long rest, at the end of which you draw all of your expended ki back into yourself. You must spend at least 30 minutes of the rest meditating to regain your ki points. Some of your ki features require your target to make a saving throw to resist the feature's effects. The saving throw DC is calculated as follows: Ki save DC = 8 + your proficiency bonus + your Wisdom modifier",
      availableAtLevel: 2,
      order: 2,
      effects: [
        selfClassRuleEffect(
          3,
          CLOSED_RULE_KIND.CLASS_MONK_KI_DISCIPLINES,
          ACTIVATION_CODE.BONUS_ACTION
        )
      ]
    },
    {
      id: classRowId(M, 3, 4),
      label: 'Unarmored Movement',
      description:
        'Starting at 2nd level, your speed increases by 10 feet while you are not wearing armor or wielding a shield. This bonus increases when you reach certain monk levels, as shown in the Monk table.',
      availableAtLevel: 2,
      order: 3,
      grants: { modifiers: unarmoredMovementModifiers }
    },
    {
      id: classRowId(M, 3, 5),
      label: 'Monastic Tradition',
      description:
        'When you reach 3rd level, you commit yourself to a monastic tradition, such as the Way of the Open Hand. Your tradition grants you features at 3rd level and again at 6th, 11th, and 17th level.',
      attributes: [FEATURE_ATTRIBUTE.SUBCLASS_SELECTION],
      availableAtLevel: 3,
      order: 4
    },
    {
      id: classRowId(M, 3, 6),
      label: 'Deflect Missiles',
      description:
        'Starting at 3rd level, you can use your reaction to deflect or catch the missile when you are hit by a ranged weapon attack. When you do so, the damage you take from the attack is reduced by 1d10 + your Dexterity modifier + your monk level. If you reduce the damage to 0, you can catch the missile if it is small enough for you to hold in one hand and you have at least one hand free. If you catch a missile in this way, you can spend 1 ki point to make a ranged attack with the weapon or piece of ammunition you just caught, as part of the same reaction. You make this attack with proficiency, regardless of your weapon proficiencies, and the missile counts as a monk weapon for the attack, which has a normal range of 20 feet and a long range of 60 feet.',
      availableAtLevel: 3,
      order: 5,
      effects: [
        closedRuleEffect({
          id: classRowId(M, 0x60, 6),
          ruleKind: CLOSED_RULE_KIND.CLASS_MONK_DEFLECT_MISSILES,
          pathCode: PATH_CODE.ON_HIT,
          invocation: {
            kind: 'ACTION',
            triggerCode: TRIGGER.RANGED_WEAPON_ATTACK,
            activation: { code: ACTIVATION_CODE.REACTION, amount: 1 },
            range: { id: classRowId(M, 0x69, 6), rangeKind: RANGE_KIND.SELF },
            targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
          }
        })
      ]
    },
    {
      id: classRowId(M, 3, 7),
      label: 'Ability Score Improvement',
      description: abilityScoreImprovementDescription,
      availableAtLevel: 4,
      order: 6,
      optionChoices: [{ level: 4, count: 1 }],
      options: abilityScoreImprovementOptions(
        (optionEntry) => classRowId(M, 7, optionEntry),
        abilityScoreImprovementDescription
      ),
      effects: [selfClassRuleEffect(7, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)]
    },
    {
      id: classRowId(M, 3, 8),
      label: 'Slow Fall',
      description:
        'Beginning at 4th level, you can use your reaction when you fall to reduce any falling damage you take by an amount equal to five times your monk level.',
      availableAtLevel: 4,
      order: 7,
      effects: [
        selfClassRuleEffect(8, CLOSED_RULE_KIND.CLASS_MONK_SLOW_FALL, ACTIVATION_CODE.REACTION)
      ]
    },
    {
      id: classRowId(M, 3, 9),
      label: 'Extra Attack',
      description:
        'Beginning at 5th level, you can attack twice, instead of once, whenever you take the Attack action on your turn.',
      availableAtLevel: 5,
      order: 8,
      grants: {
        modifiers: [attacksPerAttackActionGrant(classRowId(M, 0x6f, 1), 2)]
      }
    },
    {
      id: classRowId(M, 3, 10),
      label: 'Stunning Strike',
      description:
        "Starting at 5th level, you can interfere with the flow of ki in an opponent's body. When you hit another creature with a melee weapon attack, you can spend 1 ki point to attempt a stunning strike. The target must succeed on a Constitution saving throw or be stunned until the end of your next turn.",
      availableAtLevel: 5,
      order: 9,
      effects: [
        closedRuleEffect({
          id: classRowId(M, 0x60, 10),
          ruleKind: CLOSED_RULE_KIND.CLASS_MONK_STUNNING_STRIKE,
          pathCode: PATH_CODE.ON_HIT,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
            range: { id: classRowId(M, 0x69, 10), rangeKind: RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: 'HOSTILE'
            }
          }
        })
      ]
    },
    {
      id: classRowId(M, 3, 11),
      label: 'Ki-Empowered Strikes',
      description:
        'Starting at 6th level, your unarmed strikes count as magical for the purpose of overcoming resistance and immunity to nonmagical attacks and damage.',
      availableAtLevel: 6,
      order: 10,
      grants: {
        modifiers: [
          {
            id: classRowId(M, 0x92, 1),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_TRAIT,
            domain: {
              trait: DAMAGE_DEFENSE_BYPASS_CODE.MAGICAL,
              attackDomain: ATTACK_DOMAIN_CODE.UNARMED
            },
            modifierKind: MODIFIER_KIND.ENABLE,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            order: 0
          }
        ]
      }
    },
    {
      id: classRowId(M, 3, 12),
      label: 'Monastic Tradition Feature',
      description:
        'When you reach 3rd level, you commit yourself to a monastic tradition, such as the Way of the Open Hand. Your tradition grants you features at 3rd level and again at 6th, 11th, and 17th level.',
      availableAtLevel: 6,
      order: 11
    },
    {
      id: classRowId(M, 3, 13),
      label: 'Evasion',
      description:
        "At 7th level, your instinctive agility lets you dodge out of the way of certain area effects, such as a blue dragon's lightning breath or a fireball spell. When you are subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you instead take no damage if you succeed on the saving throw, and only half damage if you fail.",
      availableAtLevel: 7,
      order: 12,
      grants: { modifiers: [evasionGrant(classRowId(M, 0x96, 1))] }
    },
    {
      id: classRowId(M, 3, 14),
      label: 'Stillness of Mind',
      description:
        'Starting at 7th level, you can use your action to end one effect on yourself that is causing you to be charmed or frightened.',
      availableAtLevel: 7,
      order: 13,
      effects: [
        selfClassRuleEffect(
          14,
          CLOSED_RULE_KIND.CLASS_MONK_STILLNESS_OF_MIND,
          ACTIVATION_CODE.ACTION
        )
      ]
    },
    {
      id: classRowId(M, 3, 15),
      label: 'Ability Score Improvement',
      description: abilityScoreImprovementDescription,
      availableAtLevel: 8,
      order: 14,
      optionChoices: [{ level: 8, count: 1 }],
      options: abilityScoreImprovementOptions(
        (optionEntry) => classRowId(M, 15, optionEntry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(15, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(M, 3, 16),
      label: 'Unarmored Movement Improvement',
      description:
        'At 9th level, you gain the ability to move along vertical surfaces and across liquids on your turn without falling during the move.',
      availableAtLevel: 9,
      order: 15,
      effects: [
        {
          id: classRowId(M, 0x60, 16),
          order: 1,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.ACTIVATED,
            range: { id: classRowId(M, 0x69, 16), rangeKind: RANGE_KIND.SELF },
            targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
          },
          paths: [
            {
              id: classRowId(M, 0x93, 16),
              order: 1,
              pathCode: PATH_CODE.PASSIVE,
              groupType: PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: classRowId(M, 0x94, 16),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: classRowId(M, 0x95, 16),
                    effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
                    label: 'Unarmored Movement Improvement',
                    reasonCode: MANUAL_ADJUDICATION_REASON.EXTERNAL_WORLD_STATE,
                    instructions:
                      'You can move along vertical surfaces and across liquids on your turn without falling during the move. The table applies this.'
                  }
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: classRowId(M, 3, 17),
      label: 'Purity of Body',
      description:
        'At 10th level, your mastery of the ki flowing through you makes you immune to disease and poison.',
      availableAtLevel: 10,
      order: 16,
      // Poison only: the engine has no disease model, so that half stays description (D156).
      grants: {
        modifiers: [
          {
            id: classRowId(M, 0x90, 1),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE_IMMUNITY,
            domain: {},
            modifierKind: MODIFIER_KIND.ADD_OPTION,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { damageTypeId: damageTypeId('POISON') },
            order: 0
          },
          {
            id: classRowId(M, 0x90, 2),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.CONDITION_IMMUNITY,
            domain: {},
            modifierKind: MODIFIER_KIND.ADD_OPTION,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { conditionTypeId: conditionTypeId('POISONED') },
            order: 1
          }
        ]
      }
    },
    {
      id: classRowId(M, 3, 18),
      label: 'Monastic Tradition Feature',
      description:
        'When you reach 3rd level, you commit yourself to a monastic tradition, such as the Way of the Open Hand. Your tradition grants you features at 3rd level and again at 6th, 11th, and 17th level.',
      availableAtLevel: 11,
      order: 17
    },
    {
      id: classRowId(M, 3, 19),
      label: 'Ability Score Improvement',
      description: abilityScoreImprovementDescription,
      availableAtLevel: 12,
      order: 18,
      optionChoices: [{ level: 12, count: 1 }],
      options: abilityScoreImprovementOptions(
        (optionEntry) => classRowId(M, 19, optionEntry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(19, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(M, 3, 20),
      label: 'Tongue of the Sun and Moon',
      description:
        'Starting at 13th level, you learn to touch the ki of other minds so that you understand all spoken languages. Moreover, any creature that can understand a language can understand what you say.',
      availableAtLevel: 13,
      order: 19
    },
    {
      id: classRowId(M, 3, 21),
      label: 'Diamond Soul',
      description:
        'Beginning at 14th level, your mastery of ki grants you proficiency in all saving throws. Additionally, whenever you make a saving throw and fail, you can spend 1 ki point to reroll it and take the second result.',
      availableAtLevel: 14,
      order: 20,
      effects: [
        ABILITY_CODE.STRENGTH,
        ABILITY_CODE.DEXTERITY,
        ABILITY_CODE.CONSTITUTION,
        ABILITY_CODE.INTELLIGENCE,
        ABILITY_CODE.WISDOM,
        ABILITY_CODE.CHARISMA
      ].map((ability, index) =>
        closedRuleEffect({
          id: index === 0 ? classRowId(M, 0x60, 21) : classRowId(M, 0x76, index + 1),
          ruleKind: CLOSED_RULE_KIND.CLASS_MONK_DIAMOND_SOUL_REROLL,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          invocation: {
            kind: 'ACTION',
            triggerCode: TRIGGER.SAVING_THROW,
            activation: { code: ACTIVATION_CODE.FREE },
            savingThrow: {
              id: classRowId(M, 0x78, index + 1),
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS[ability],
              dcMethod: SAVING_THROW_DC_METHOD.SOURCE_SAVE_DC
            },
            range: {
              id: index === 0 ? classRowId(M, 0x69, 21) : classRowId(M, 0x77, index + 1),
              rangeKind: RANGE_KIND.SELF
            },
            targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
          }
        })
      ),
      grants: {
        proficiencies: [
          {
            id: classRowId(M, 3, 210),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.SAVE_ABILITY,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            abilities: [
              ABILITY_CODE.STRENGTH,
              ABILITY_CODE.DEXTERITY,
              ABILITY_CODE.CONSTITUTION,
              ABILITY_CODE.INTELLIGENCE,
              ABILITY_CODE.WISDOM,
              ABILITY_CODE.CHARISMA
            ],
            order: 0
          }
        ]
      }
    },
    {
      id: classRowId(M, 3, 22),
      label: 'Timeless Body',
      description:
        "At 15th level, your ki sustains you so that you suffer none of the frailty of old age, and you can't be aged magically. You can still die of old age, however. In addition, you no longer need food or water.",
      availableAtLevel: 15,
      order: 21
    },
    {
      id: classRowId(M, 3, 23),
      label: 'Ability Score Improvement',
      description: abilityScoreImprovementDescription,
      availableAtLevel: 16,
      order: 22,
      optionChoices: [{ level: 16, count: 1 }],
      options: abilityScoreImprovementOptions(
        (optionEntry) => classRowId(M, 23, optionEntry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(23, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(M, 3, 24),
      label: 'Monastic Tradition Feature',
      description:
        'When you reach 3rd level, you commit yourself to a monastic tradition, such as the Way of the Open Hand. Your tradition grants you features at 3rd level and again at 6th, 11th, and 17th level.',
      availableAtLevel: 17,
      order: 23
    },
    {
      id: classRowId(M, 3, 25),
      label: 'Empty Body',
      description:
        "Beginning at 18th level, you can use your action to spend 4 ki points to become invisible for 1 minute. During that time, you also have resistance to all damage but force damage. Additionally, you can spend 8 ki points to cast the astral projection spell, without needing material components. When you do so, you can't take any other creatures with you.",
      availableAtLevel: 18,
      order: 24,
      // Astral Projection for 8 ki stays description: a spell grant cannot spend a class pool yet.
      effects: [
        {
          id: classRowId(M, 0x60, 25),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: TRIGGER.ACTIVATED,
            resourceUse: { chargeId: kiCharge.id, cost: 4 },
            activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: classRowId(M, 0x69, 25), rangeKind: RANGE_KIND.SELF },
            targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
          },
          paths: [
            {
              id: classRowId(M, 0x80, 25),
              order: 1,
              pathCode: PATH_CODE.ON_USE,
              groupType: PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: classRowId(M, 0x81, 25),
                resultKind: 'SINGLE',
                duration: { id: classRowId(M, 0x83, 25), durationKind: 'MINUTE', amount: 1 },
                outcomes: [
                  {
                    id: classRowId(M, 0x82, 25),
                    effectKind: EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('INVISIBLE')
                  },
                  {
                    id: classRowId(M, 0x84, 25),
                    effectKind: EFFECT_KIND.APPLY_GRANT,
                    grants: {
                      modifiers: SRD_DAMAGE_TYPES.filter(({ code }) => code !== 'FORCE').map(
                        (damageType, index) => ({
                          id: classRowId(M, 0x85, index + 1),
                          grantKind: GRANT_KIND.MODIFIER_GRANT,
                          valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE_RESISTANCE,
                          domain: {},
                          modifierKind: MODIFIER_KIND.ADD_OPTION,
                          scope: MODIFIER_SCOPE_KIND.GLOBAL,
                          selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                          payload: { damageTypeId: damageType.id },
                          order: index
                        })
                      )
                    }
                  }
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: classRowId(M, 3, 26),
      label: 'Ability Score Improvement',
      description: abilityScoreImprovementDescription,
      availableAtLevel: 19,
      order: 25,
      optionChoices: [{ level: 19, count: 1 }],
      options: abilityScoreImprovementOptions(
        (optionEntry) => classRowId(M, 26, optionEntry),
        abilityScoreImprovementDescription
      ),
      effects: [
        selfClassRuleEffect(26, CLOSED_RULE_KIND.CLASS_ABILITY_SCORE_IMPROVEMENT_MAXIMUM_20)
      ]
    },
    {
      id: classRowId(M, 3, 27),
      label: 'Perfect Self',
      description:
        'At 20th level, when you roll for initiative and have no ki points remaining, you regain 4 ki points.',
      availableAtLevel: 20,
      order: 26,
      effects: [
        {
          id: classRowId(M, 0x60, 27),
          order: 1,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.ROLL_INITIATIVE,
            range: { id: classRowId(M, 0x69, 27), rangeKind: RANGE_KIND.SELF },
            targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
          },
          paths: [
            {
              id: classRowId(M, 0x80, 27),
              order: 1,
              pathCode: PATH_CODE.PASSIVE,
              groupType: PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: classRowId(M, 0x81, 27),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: classRowId(M, 0x82, 27),
                    effectKind: EFFECT_KIND.RESTORE_RESOURCE,
                    chargeId: kiCharge.id,
                    floor: 4,
                    whenAtOrBelow: 0
                  }
                ]
              }
            }
          ]
        }
      ]
    }
  ]
}
