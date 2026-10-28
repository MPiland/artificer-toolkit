import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import { CHANGE_SHAPE_RULING } from './changeShapeRuling.js'
import { DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'
export const adultSilverDragon: CreatureAuthored = {
  id: S.CREATURE_IDS.ADULT_SILVER_DRAGON,
  label: 'Adult Silver Dragon',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.DRAGON,
  size: S.SIZE_CODE.HUGE,
  alignmentId: '00000000-0000-0000-0001-000100000000',
  abilityScores: {
    STRENGTH: 27,
    DEXTERITY: 10,
    CONSTITUTION: 25,
    INTELLIGENCE: 16,
    WISDOM: 13,
    CHARISMA: 21
  },
  naturalArmorBonus: 9,
  hitPoints: 243,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 18,
    die: 12,
    modifier: 126
  },
  speeds: [...S.walk(40), ...S.fly(80)],
  proficiencies: [
    S.grantedSkillExpertise(11, 4, 'PERCEPTION'),
    S.grantedSaveProficiency(11, 1, 'DEXTERITY', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedSkillProficiency(11, 2, 'ARCANA', 'HISTORY', 'STEALTH'),
    S.grantedLanguageProficiency(11, 3, 'COMMON', 'DRACONIC')
  ],
  damageImmunities: ['cold'],
  senses: [S.blindsight(60), S.darkvision(120)],
  passivePerception: 21,
  challengeRatingId: S.CR.CR_16,
  xp: 15000,
  features: [
    {
      id: S.featureId(11, 1),
      ruleDefinitionIds: [S.DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID],
      label: 'Legendary Resistance (3/Day)',
      description:
        'Legendary Resistance (3/Day). If the dragon fails a saving throw, it can choose to succeed instead.',
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.legendaryActionId(11, 20),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.LONG_REST,
        amount: 3
      },
      order: 1
    },
    {
      id: S.featureId(11, 2),
      label: 'Multiattack',
      description:
        'The dragon can use its Frightful Presence. It then makes three attacks: one with its bite and two with its claws.',
      attackSlots: {
        alternatives: [
          {
            slots: [
              {
                count: 1,
                fillers: [{ kind: 'FEATURE', featureId: S.featureId(11, 6) }],
                optional: true,
                comesFirst: true
              },
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(11, 3) }] },
              { count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(11, 4) }] }
            ]
          }
        ]
      },
      order: 2
    },
    {
      id: S.featureId(11, 3),
      label: 'Bite',
      description:
        'Melee Weapon Attack: +13 to hit, reach 10 ft., one target. Hit: 19 (2d10 + 8) piercing damage.',
      effects: [
        {
          id: S.actionId(11, 13),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(11, 14),
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
              id: S.actionId(11, 15),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(11, 15) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(11, 15),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d10',
                    bonuses: [
                      {
                        id: S.actionId(11, 16),
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
      id: S.featureId(11, 4),
      label: 'Claw',
      description:
        'Melee Weapon Attack: +13 to hit, reach 5 ft., one target. Hit: 15 (2d6 + 8) slashing damage.',
      effects: [
        {
          id: S.actionId(11, 17),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(11, 18),
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
              id: S.actionId(11, 19),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(11, 19) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(11, 19),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6',
                    bonuses: [
                      {
                        id: S.actionId(11, 20),
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
      id: S.featureId(11, 5),
      label: 'Tail',
      description:
        'Melee Weapon Attack: +13 to hit, reach 15 ft., one target. Hit: 17 (2d8 + 8) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(11, 21),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(11, 22),
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
              id: S.actionId(11, 23),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(11, 23) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(11, 23),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d8',
                    bonuses: [
                      {
                        id: S.actionId(11, 24),
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
      id: S.featureId(11, 6),
      label: 'Frightful Presence',
      description:
        "Each creature of the dragon's choice that is within 120 feet of the dragon and aware of it must succeed on a DC 18 Wisdom saving throw or become frightened for 1 minute. A creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success. If a creature's saving throw is successful or the effect ends for it, the creature is immune to the dragon's Frightful Presence for the next 24 hours.",
      effects: [
        S.minuteFearSaveEffect(11, {
          localIndex: 2000,
          dc: 18,
          reach: { chosenWithinFeet: 120 }
        })
      ],
      order: 6
    },
    {
      id: S.featureId(11, 7),
      ruleDefinitionIds: [S.DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID],
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: S.rechargeFeatureCharge(S.featureId(11, 7)),
      label: 'Breath Weapons (Recharge 5-6)',
      description:
        'The dragon uses one of the following breath weapons. Cold Breath. The dragon exhales an icy blast in a 60-foot cone. Each creature in that area must make a DC 20 Constitution saving throw, taking 58 (13d8) cold damage on a failed save, or half as much damage on a successful one. Paralyzing Breath. The dragon exhales paralyzing gas in a 60-foot cone. Each creature in that area must succeed on a DC 20 Constitution saving throw or be paralyzed for 1 minute. A creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success.',
      effects: [
        {
          id: S.actionId(11, 31),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(11, 32),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION,
              baseDc: 20
            },
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            ...S.selfCone(S.actionId(11, 33), S.actionId(11, 615), 60)
          },
          paths: [
            {
              id: S.actionId(11, 34),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(11, 34) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(11, 34),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('COLD'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '13d8'
                  }
                ]
              }
            },
            {
              id: S.actionId(11, 35),
              order: 2,
              pathCode: S.PATH_CODE.ON_SAVE_SUCCESS,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(11, 35) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(11, 35),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('COLD'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '13d8',
                    multiplier: 0.5
                  }
                ]
              }
            }
          ]
        },
        {
          id: S.actionId(11, 36),
          order: 2,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(11, 37),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION,
              baseDc: 20
            },
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            ...S.selfCone(S.actionId(11, 38), S.actionId(11, 616), 60)
          },
          paths: [
            {
              id: S.actionId(11, 39),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(11, 617),
                resultKind: 'SEQUENCE' as const,
                duration: {
                  id: S.actionId(11, 611),
                  durationKind: DURATION_KIND.MINUTE,
                  amount: 1
                },
                outcomes: [
                  {
                    id: S.actionId(11, 612),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('PARALYZED')
                  },
                  {
                    id: S.actionId(11, 613),
                    effectKind: S.EFFECT_KIND.FOLLOW_UP_SAVE,
                    timing: 'TARGET_TURN_END',
                    savingThrow: {
                      id: S.actionId(11, 614),
                      dcMethod: 'FIXED_DC',
                      abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION,
                      baseDc: 20
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
      id: S.featureId(11, 10),
      label: 'Change Shape',
      description:
        "Change Shape. The dragon magically polymorphs into a humanoid or beast that has a challenge rating no higher than its own, or back into its true form. It reverts to its true form if it dies. Any equipment it is wearing or carrying is absorbed or borne by the new form (the dragon's choice). In a new form, the dragon retains its alignment, hit points, Hit Dice, ability to speak, proficiencies, Legendary Resistance, lair actions, and Intelligence, Wisdom, and Charisma scores, as well as this action. Its statistics and capabilities are otherwise replaced by those of the new form, except any class features or legendary actions of that form.",
      effects: [
        {
          id: S.actionId(11, 40),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(11, 41), rangeKind: S.RANGE_KIND.SELF }
          },
          paths: [
            {
              id: S.actionId(11, 42),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(11, 42) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(11, 42),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION,
                    ...CHANGE_SHAPE_RULING.CR_CAPPED_FORM
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 10
    },
    {
      id: S.featureId(11, 11),
      options: [
        {
          id: '00000000-0005-00c9-0070-000b00000000',
          label: 'Detect',
          description: 'The dragon makes a Wisdom (Perception) check.',
          order: 1
        },
        {
          id: '00000000-0005-00ca-0070-000b00000000',
          label: 'Tail Attack',
          description: 'The dragon makes a tail attack.',
          order: 2,
          actionReference: { featureId: S.featureId(11, 5), chargeCost: 1 }
        },
        {
          id: '00000000-0005-00cb-0070-000b00000000',
          label: 'Wing Attack (Costs 2 Actions)',
          description:
            'The dragon beats its wings. Each creature within 10 feet of the dragon must succeed on a DC 21 Dexterity saving throw or take 15 (2d6 + 8) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
          order: 3,
          effects: [
            {
              id: '00000000-0005-001c-0070-000b00000000',
              order: 3,
              invocation: {
                kind: 'ACTION',
                triggerCode: 'SAVING_THROW',
                savingThrow: {
                  id: '00000000-0005-001f-0070-000b00000000',
                  dcMethod: 'FIXED_DC',
                  abilityDefinitionId: '00000000-0000-0000-0011-000200000000',
                  baseDc: 21
                },
                activation: { code: 'FREE' },
                range: { id: '00000000-0005-001d-0070-000b00000000', rangeKind: 'SELF' },
                shape: {
                  id: '00000000-0005-0069-0070-000b00000000',
                  shapeKind: 'SPHERE',
                  radius: { amount: 10, unit: 'FEET' }
                },
                targeting: { selectionKind: 'AREA_CONTENTS', dispositionKind: 'ANY' },
                resourceUse: { chargeId: '00000000-0005-0015-0070-000b00000000', cost: 2 }
              },
              paths: [
                {
                  id: '00000000-0005-001e-0070-000b00000000',
                  order: 1,
                  pathCode: 'ON_SAVE_FAIL',
                  groupType: 'SINGLE',
                  originKind: 'SOURCE',
                  selectionKind: 'FIXED',
                  resultBlock: {
                    id: '00000000-0005-001e-0070-000b00000000__result',
                    resultKind: 'SINGLE',
                    outcomes: [
                      {
                        id: '00000000-0005-001e-0070-000b00000000',
                        effectKind: 'DAMAGE',
                        damageTypeId: '00000000-0000-0000-0004-000200000000',
                        valueKind: 'DICE',
                        scalingKind: 'NONE',
                        diceConfig: '2d6+8'
                      },
                      {
                        id: '00000000-0005-0067-0070-000b00000000',
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
        id: S.legendaryActionId(11, 21),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.MANUAL,
        amount: 3
      },
      order: 11
    }
  ]
}
