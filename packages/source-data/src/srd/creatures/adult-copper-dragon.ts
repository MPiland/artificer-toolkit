import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import { DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const adultCopperDragon: CreatureAuthored = {
  id: S.CREATURE_IDS.ADULT_COPPER_DRAGON,
  label: 'Adult Copper Dragon',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.DRAGON,
  size: S.SIZE_CODE.HUGE,
  alignmentId: '00000000-0000-0000-0001-000300000000',
  abilityScores: {
    STRENGTH: 23,
    DEXTERITY: 12,
    CONSTITUTION: 21,
    INTELLIGENCE: 18,
    WISDOM: 15,
    CHARISMA: 17
  },
  naturalArmorBonus: 7,
  hitPoints: 184,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 16,
    die: 12,
    modifier: 80
  },
  speeds: [...S.walk(40), ...S.climb(40), ...S.fly(80)],
  proficiencies: [
    S.grantedSkillExpertise(7, 4, 'PERCEPTION'),
    S.grantedSaveProficiency(7, 1, 'DEXTERITY', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedSkillProficiency(7, 2, 'DECEPTION', 'STEALTH'),
    S.grantedLanguageProficiency(7, 3, 'COMMON', 'DRACONIC')
  ],
  damageImmunities: ['acid'],
  senses: [S.blindsight(60), S.darkvision(120)],
  passivePerception: 22,
  challengeRatingId: S.CR.CR_14,
  xp: 11500,
  features: [
    {
      id: S.featureId(7, 1),
      ruleDefinitionIds: [S.DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID],
      label: 'Legendary Resistance (3/Day)',
      description:
        'Legendary Resistance (3/Day). If the dragon fails a saving throw, it can choose to succeed instead.',
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.legendaryActionId(7, 20),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.LONG_REST,
        amount: 3
      },
      order: 1
    },
    {
      id: S.featureId(7, 2),
      label: 'Multiattack',
      description:
        'The dragon can use its Frightful Presence. It then makes three attacks: one with its bite and two with its claws.',
      attackSlots: {
        alternatives: [
          {
            slots: [
              {
                count: 1,
                fillers: [{ kind: 'FEATURE', featureId: S.featureId(7, 6) }],
                optional: true,
                comesFirst: true
              },
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(7, 3) }] },
              { count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(7, 4) }] }
            ]
          }
        ]
      },
      order: 2
    },
    {
      id: S.featureId(7, 3),
      label: 'Bite',
      description:
        'Melee Weapon Attack: +11 to hit, reach 10 ft., one target. Hit: 17 (2d10 + 6) piercing damage.',
      effects: [
        {
          id: S.actionId(7, 13),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(7, 14),
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
              id: S.actionId(7, 15),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(7, 15) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(7, 15),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d10',
                    bonuses: [
                      {
                        id: S.actionId(7, 16),
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
      order: 3
    },
    {
      id: S.featureId(7, 4),
      label: 'Claw',
      description:
        'Melee Weapon Attack: +11 to hit, reach 5 ft., one target. Hit: 13 (2d6 + 6) slashing damage.',
      effects: [
        {
          id: S.actionId(7, 17),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(7, 18),
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
              id: S.actionId(7, 19),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(7, 19) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(7, 19),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6',
                    bonuses: [
                      {
                        id: S.actionId(7, 20),
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
      id: S.featureId(7, 5),
      label: 'Tail',
      description:
        'Melee Weapon Attack: +11 to hit, reach 15 ft., one target. Hit: 15 (2d8 + 6) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(7, 21),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(7, 22),
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
              id: S.actionId(7, 23),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(7, 23) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(7, 23),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d8',
                    bonuses: [
                      {
                        id: S.actionId(7, 24),
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
      id: S.featureId(7, 6),
      label: 'Frightful Presence',
      description:
        "Each creature of the dragon's choice that is within 120 feet of the dragon and aware of it must succeed on a DC 16 Wisdom saving throw or become frightened for 1 minute. A creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success. If a creature's saving throw is successful or the effect ends for it, the creature is immune to the dragon's Frightful Presence for the next 24 hours.",
      effects: [
        S.minuteFearSaveEffect(7, {
          localIndex: 2000,
          dc: 16,
          reach: { chosenWithinFeet: 120 }
        })
      ],
      order: 6
    },
    {
      id: S.featureId(7, 7),
      ruleDefinitionIds: [S.DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID],
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: S.rechargeFeatureCharge(S.featureId(7, 7)),
      label: 'Breath Weapons (Recharge 5-6)',
      description:
        "The dragon uses one of the following breath weapons. Acid Breath. The dragon exhales acid in a 60-foot line that is 5 feet wide. Each creature in that line must make a DC 18 Dexterity saving throw, taking 54 (12d8) acid damage on a failed save, or half as much damage on a successful one. Slowing Breath. The dragon exhales gas in a 60-foot cone. Each creature in that area must succeed on a DC 18 Constitution saving throw. On a failed save, the creature can't use reactions, its speed is halved, and it can't make more than one attack on its turn. In addition, the creature can use either an action or a bonus action on its turn, but not both. These effects last for 1 minute. The creature can repeat the saving throw at the end of each of its turns, ending the effect on itself with a successful save.",
      effects: [
        {
          id: S.actionId(7, 28),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(7, 29),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.DEXTERITY,
              baseDc: 18
            },
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            ...S.selfLine(S.actionId(7, 30), S.actionId(7, 618), 60, 5)
          },
          paths: [
            {
              id: S.actionId(7, 31),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(7, 31) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(7, 31),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('ACID'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '12d8'
                  }
                ]
              }
            },
            {
              id: S.actionId(7, 32),
              order: 2,
              pathCode: S.PATH_CODE.ON_SAVE_SUCCESS,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(7, 32) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(7, 32),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('ACID'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '12d8',
                    multiplier: 0.5
                  }
                ]
              }
            }
          ]
        },
        {
          id: S.actionId(7, 33),
          order: 2,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(7, 34),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION,
              baseDc: 18
            },
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            ...S.selfCone(S.actionId(7, 35), S.actionId(7, 619), 60)
          },
          paths: [
            {
              id: S.actionId(7, 36),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(7, 900),
                resultKind: 'SEQUENCE' as const,
                duration: {
                  id: S.actionId(7, 615),
                  durationKind: DURATION_KIND.MINUTE,
                  amount: 1
                },
                outcomes: [
                  {
                    id: S.actionId(7, 901),
                    effectKind: S.EFFECT_KIND.APPLY_GRANT,
                    grants: {
                      modifiers: [
                        {
                          id: S.actionId(7, 902),
                          grantKind: 'MODIFIER_GRANT',
                          valueDomainCode: 'REACTION_COUNT',
                          domain: {},
                          modifierKind: 'SET_VALUE',
                          scope: 'GLOBAL',
                          selectionKind: 'GRANTED',
                          payload: { amount: 0 },
                          order: 1
                        },
                        {
                          id: S.actionId(7, 903),
                          grantKind: 'MODIFIER_GRANT',
                          valueDomainCode: 'SPEED',
                          domain: {},
                          modifierKind: 'MULTIPLY',
                          scope: 'GLOBAL',
                          selectionKind: 'GRANTED',
                          payload: { numerator: 1, denominator: 2 },
                          order: 2
                        },
                        {
                          id: S.actionId(7, 904),
                          grantKind: 'MODIFIER_GRANT',
                          valueDomainCode: 'ATTACKS_PER_ATTACK_ACTION',
                          domain: {},
                          modifierKind: 'CAP_VALUE',
                          scope: 'GLOBAL',
                          selectionKind: 'GRANTED',
                          payload: { amount: 1 },
                          order: 3
                        },
                        {
                          id: S.actionId(7, 905),
                          grantKind: 'MODIFIER_GRANT',
                          valueDomainCode: 'ACTION_BONUS_ACTION_EXCLUSIVITY',
                          domain: {},
                          modifierKind: 'ENABLE',
                          scope: 'GLOBAL',
                          selectionKind: 'GRANTED',
                          order: 4
                        }
                      ]
                    }
                  },
                  {
                    id: S.actionId(7, 616),
                    effectKind: S.EFFECT_KIND.FOLLOW_UP_SAVE,
                    timing: 'TARGET_TURN_END',
                    savingThrow: {
                      id: S.actionId(7, 617),
                      dcMethod: 'FIXED_DC',
                      abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION,
                      baseDc: 18
                    },
                    attempts: { kind: 'ONCE', repeatOnFailure: true },
                    onSuccess: { kind: 'END' },
                    onFailure: { kind: 'CONTINUE' }
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
      id: S.featureId(7, 9),
      options: [
        {
          id: '00000000-0005-00c9-0070-000700000000',
          label: 'Detect',
          description: 'The dragon makes a Wisdom (Perception) check.',
          order: 1
        },
        {
          id: '00000000-0005-00ca-0070-000700000000',
          label: 'Tail Attack',
          description: 'The dragon makes a tail attack.',
          order: 2,
          actionReference: { featureId: S.featureId(7, 5), chargeCost: 1 }
        },
        {
          id: '00000000-0005-00cb-0070-000700000000',
          label: 'Wing Attack (Costs 2 Actions)',
          description:
            'The dragon beats its wings. Each creature within 10 feet of the dragon must succeed on a DC 19 Dexterity saving throw or take 13 (2d6 + 6) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
          order: 3,
          effects: [
            {
              id: '00000000-0005-001c-0070-000700000000',
              order: 3,
              invocation: {
                kind: 'ACTION',
                triggerCode: 'SAVING_THROW',
                savingThrow: {
                  id: '00000000-0005-001f-0070-000700000000',
                  dcMethod: 'FIXED_DC',
                  abilityDefinitionId: '00000000-0000-0000-0011-000200000000',
                  baseDc: 19
                },
                activation: { code: 'FREE' },
                range: { id: '00000000-0005-001d-0070-000700000000', rangeKind: 'SELF' },
                shape: {
                  id: '00000000-0005-0069-0070-000700000000',
                  shapeKind: 'SPHERE',
                  radius: { amount: 10, unit: 'FEET' }
                },
                targeting: { selectionKind: 'AREA_CONTENTS', dispositionKind: 'ANY' },
                resourceUse: { chargeId: '00000000-0005-0015-0070-000700000000', cost: 2 }
              },
              paths: [
                {
                  id: '00000000-0005-001e-0070-000700000000',
                  order: 1,
                  pathCode: 'ON_SAVE_FAIL',
                  groupType: 'SINGLE',
                  originKind: 'SOURCE',
                  selectionKind: 'FIXED',
                  resultBlock: {
                    id: '00000000-0005-001e-0070-000700000000__result',
                    resultKind: 'SINGLE',
                    outcomes: [
                      {
                        id: '00000000-0005-001e-0070-000700000000',
                        effectKind: 'DAMAGE',
                        damageTypeId: '00000000-0000-0000-0004-000200000000',
                        valueKind: 'DICE',
                        scalingKind: 'NONE',
                        diceConfig: '2d6+6'
                      },
                      {
                        id: '00000000-0005-0067-0070-000700000000',
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
        id: S.legendaryActionId(7, 21),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.MANUAL,
        amount: 3
      },
      order: 9
    }
  ]
}
