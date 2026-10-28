import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const adultRedDragon: CreatureAuthored = {
  id: S.CREATURE_IDS.ADULT_RED_DRAGON,
  label: 'Adult Red Dragon',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.DRAGON,
  size: S.SIZE_CODE.HUGE,
  alignmentId: '00000000-0000-0000-0001-000900000000',
  abilityScores: {
    STRENGTH: 27,
    DEXTERITY: 10,
    CONSTITUTION: 25,
    INTELLIGENCE: 16,
    WISDOM: 13,
    CHARISMA: 21
  },
  naturalArmorBonus: 9,
  hitPoints: 256,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 19,
    die: 12,
    modifier: 133
  },
  speeds: [...S.walk(40), ...S.climb(40), ...S.fly(80)],
  proficiencies: [
    S.grantedSkillExpertise(10, 4, 'PERCEPTION'),
    S.grantedSaveProficiency(10, 1, 'DEXTERITY', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedSkillProficiency(10, 2, 'STEALTH'),
    S.grantedLanguageProficiency(10, 3, 'COMMON', 'DRACONIC')
  ],
  damageImmunities: ['fire'],
  senses: [S.blindsight(60), S.darkvision(120)],
  passivePerception: 23,
  challengeRatingId: S.CR.CR_17,
  xp: 18000,
  features: [
    {
      id: S.featureId(10, 1),
      ruleDefinitionIds: [S.DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID],
      label: 'Legendary Resistance (3/Day)',
      description:
        'Legendary Resistance (3/Day). If the dragon fails a saving throw, it can choose to succeed instead.',
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.legendaryActionId(10, 20),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.MANUAL,
        amount: 3
      },
      order: 1
    },
    {
      id: S.featureId(10, 2),
      label: 'Multiattack',
      description:
        'The dragon can use its Frightful Presence. It then makes three attacks: one with its bite and two with its claws.',
      attackSlots: {
        alternatives: [
          {
            slots: [
              {
                count: 1,
                fillers: [{ kind: 'FEATURE', featureId: S.featureId(10, 6) }],
                optional: true,
                comesFirst: true
              },
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(10, 3) }] },
              { count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(10, 4) }] }
            ]
          }
        ]
      },
      order: 2
    },
    {
      id: S.featureId(10, 3),
      label: 'Bite',
      description:
        'Melee Weapon Attack: +14 to hit, reach 10 ft., one target. Hit: 19 (2d10 + 8) piercing damage plus 7 (2d6) fire damage.',
      effects: [
        {
          id: S.actionId(10, 13),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(10, 14),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 10,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(10, 15),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(10, 15) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(10, 15),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d10',
                    bonuses: [
                      {
                        id: S.actionId(10, 16),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.STRENGTH,
                        order: 1
                      }
                    ]
                  }
                ]
              }
            },
            {
              id: S.actionId(10, 17),
              order: 2,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(10, 17) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(10, 17),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('FIRE'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6'
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 3
    },
    {
      id: S.featureId(10, 4),
      label: 'Claw',
      description:
        'Melee Weapon Attack: +14 to hit, reach 5 ft., one target. Hit: 15 (2d6 + 8) slashing damage.',
      effects: [
        {
          id: S.actionId(10, 18),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(10, 19),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 5,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(10, 20),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(10, 20) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(10, 20),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6',
                    bonuses: [
                      {
                        id: S.actionId(10, 21),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.STRENGTH,
                        order: 1
                      }
                    ]
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 4
    },
    {
      id: S.featureId(10, 5),
      label: 'Tail',
      description:
        'Melee Weapon Attack: +14 to hit, reach 15 ft., one target. Hit: 17 (2d8 + 8) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(10, 22),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(10, 23),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 15,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(10, 24),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(10, 24) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(10, 24),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d8',
                    bonuses: [
                      {
                        id: S.actionId(10, 25),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.STRENGTH,
                        order: 1
                      }
                    ]
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 5
    },
    {
      id: S.featureId(10, 6),
      label: 'Frightful Presence',
      description:
        "Each creature of the dragon's choice that is within 120 feet of the dragon and aware of it must succeed on a DC 19 Wisdom saving throw or become frightened for 1 minute. A creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success. If a creature's saving throw is successful or the effect ends for it, the creature is immune to the dragon's Frightful Presence for the next 24 hours.",
      effects: [
        S.minuteFearSaveEffect(10, {
          localIndex: 2000,
          dc: 19,
          reach: { chosenWithinFeet: 120 }
        })
      ],
      order: 6
    },
    {
      id: S.featureId(10, 7),
      ruleDefinitionIds: [S.DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID],
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: S.rechargeFeatureCharge(S.featureId(10, 7)),
      label: 'Fire Breath (Recharge 5-6)',
      description:
        'The dragon exhales fire in a 60-foot cone. Each creature in that area must make a DC 21 Dexterity saving throw, taking 63 (18d6) fire damage on a failed save, or half as much damage on a successful one.',
      effects: [
        {
          id: S.actionId(10, 29),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(10, 30),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.DEXTERITY,
              baseDc: 21
            },
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            ...S.selfCone(S.actionId(10, 31), S.actionId(10, 200), 60)
          },
          paths: [
            {
              id: S.actionId(10, 32),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(10, 32) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(10, 32),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('FIRE'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '18d6'
                  }
                ]
              }
            },
            {
              id: S.actionId(10, 33),
              order: 2,
              pathCode: S.PATH_CODE.ON_SAVE_SUCCESS,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(10, 33) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(10, 33),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('FIRE'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '18d6',
                    multiplier: 0.5
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 7
    },
    {
      id: S.featureId(10, 8),
      options: [
        {
          id: '00000000-0005-00c9-0070-000a00000000',
          label: 'Detect',
          description: 'The dragon makes a Wisdom (Perception) check.',
          order: 1
        },
        {
          id: '00000000-0005-00ca-0070-000a00000000',
          label: 'Tail Attack',
          description: 'The dragon makes a tail attack.',
          order: 2,
          actionReference: { featureId: S.featureId(10, 5), chargeCost: 1 }
        },
        {
          id: '00000000-0005-00cb-0070-000a00000000',
          label: 'Wing Attack (Costs 2 Actions)',
          description:
            'The dragon beats its wings. Each creature within 10 feet of the dragon must succeed on a DC 22 Dexterity saving throw or take 15 (2d6 + 8) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
          order: 3,
          effects: [
            {
              id: '00000000-0005-001c-0070-000a00000000',
              order: 3,
              invocation: {
                kind: 'ACTION',
                triggerCode: 'SAVING_THROW',
                savingThrow: {
                  id: '00000000-0005-001f-0070-000a00000000',
                  dcMethod: 'FIXED_DC',
                  abilityDefinitionId: '00000000-0000-0000-0011-000200000000',
                  baseDc: 22
                },
                activation: { code: 'FREE' },
                range: { id: '00000000-0005-001d-0070-000a00000000', rangeKind: 'SELF' },
                shape: {
                  id: '00000000-0005-0069-0070-000a00000000',
                  shapeKind: 'SPHERE',
                  radius: { amount: 10, unit: 'FEET' }
                },
                targeting: { selectionKind: 'AREA_CONTENTS', dispositionKind: 'ANY' },
                resourceUse: { chargeId: '00000000-0005-0015-0070-000a00000000', cost: 2 }
              },
              paths: [
                {
                  id: '00000000-0005-001e-0070-000a00000000',
                  order: 1,
                  pathCode: 'ON_SAVE_FAIL',
                  groupType: 'SINGLE',
                  originKind: 'SOURCE',
                  selectionKind: 'FIXED',
                  resultBlock: {
                    id: '00000000-0005-001e-0070-000a00000000__result',
                    resultKind: 'SINGLE',
                    outcomes: [
                      {
                        id: '00000000-0005-001e-0070-000a00000000',
                        effectKind: 'DAMAGE',
                        damageTypeId: '00000000-0000-0000-0004-000200000000',
                        valueKind: 'DICE',
                        scalingKind: 'NONE',
                        diceConfig: '2d6+8'
                      },
                      {
                        id: '00000000-0005-0067-0070-000a00000000',
                        effectKind: 'CONDITION',
                        conditionId: '00000000-0000-0000-0002-000c00000000'
                      }
                    ]
                  }
                }
              ]
            }
          ]
        }
      ],
      ruleDefinitionIds: [S.DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID],
      label: 'Legendary Actions',
      section: 'LEGENDARY_ACTION',
      description:
        "The dragon can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The dragon regains spent legendary actions at the start of its turn.",
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.legendaryActionId(10, 21),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.MANUAL,
        amount: 3
      },
      order: 8
    }
  ]
}
