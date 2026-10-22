import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import { DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const youngGoldDragon: CreatureAuthored = {
  id: S.CREATURE_IDS.YOUNG_GOLD_DRAGON,
  label: 'Young Gold Dragon',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.DRAGON,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000100000000',
  abilityScores: {
    STRENGTH: 23,
    DEXTERITY: 14,
    CONSTITUTION: 21,
    INTELLIGENCE: 16,
    WISDOM: 13,
    CHARISMA: 20
  },
  naturalArmorBonus: 6,
  hitPoints: 178,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 17,
    die: 10,
    modifier: 85
  },
  speeds: [...S.walk(40), ...S.fly(80), ...S.swim(40)],
  proficiencies: [
    S.grantedLanguageProficiency(9907, 4, 'COMMON', 'DRACONIC'),
    S.grantedSkillExpertise(9907, 3, 'PERCEPTION'),
    S.grantedSaveProficiency(9907, 2, 'DEXTERITY', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedSkillProficiency(9907, 1, 'INSIGHT', 'PERSUASION', 'STEALTH')
  ],
  damageImmunities: ['fire'],
  senses: [S.blindsight(30), S.darkvision(120)],
  passivePerception: 19,
  challengeRatingId: S.CR.CR_10,
  xp: 5900,
  features: [
    {
      id: S.featureId(306, 1),
      label: 'Amphibious',
      description: 'Amphibious. The dragon can breathe air and water.',
      order: 1
    },
    {
      id: S.featureId(306, 2),
      ruleDefinitionIds: [S.DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID],
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: S.rechargeFeatureCharge(S.featureId(306, 2)),
      label: 'Breath Weapons (Recharge 5-6)',
      description:
        'The dragon uses one of the following breath weapons. Fire Breath. The dragon exhales fire in a 30-foot cone. Each creature in that area must make a DC 17 Dexterity saving throw, taking 55 (10d10) fire damage on a failed save, or half as much damage on a successful one. Weakening Breath. The dragon exhales gas in a 30-foot cone. Each creature in that area must succeed on a DC 17 Strength saving throw or have disadvantage on Strength-based attack rolls, Strength checks, and Strength saving throws for 1 minute. A creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success.',
      effects: [
        {
          id: S.actionId(306, 202),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(306, 203),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.DEXTERITY,
              baseDc: 17
            },
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            ...S.selfCone(S.actionId(306, 204), S.actionId(306, 239), 30)
          },
          paths: [
            {
              id: S.actionId(306, 205),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(306, 206),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(306, 207),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('FIRE'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '10d10'
                  }
                ]
              }
            },
            {
              id: S.actionId(306, 208),
              order: 2,
              pathCode: S.PATH_CODE.ON_SAVE_SUCCESS,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(306, 209),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(306, 210),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('FIRE'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '10d10',
                    multiplier: 0.5
                  }
                ]
              }
            }
          ]
        },
        {
          id: S.actionId(306, 230),
          order: 2,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(306, 231),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.STRENGTH,
              baseDc: 17
            },
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            ...S.selfCone(S.actionId(306, 232), S.actionId(306, 240), 30)
          },
          paths: [
            {
              id: S.actionId(306, 233),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(306, 900),
                resultKind: 'SEQUENCE',
                duration: {
                  id: S.actionId(306, 235),
                  durationKind: DURATION_KIND.MINUTE,
                  amount: 1
                },
                outcomes: [
                  {
                    id: S.actionId(306, 901),
                    effectKind: S.EFFECT_KIND.APPLY_GRANT,
                    grants: {
                      modifiers: [
                        {
                          id: S.actionId(306, 902),
                          grantKind: 'MODIFIER_GRANT',
                          valueDomainCode: 'ABILITY_CHECK',
                          domain: { ability: S.ABILITY_CODE.STRENGTH },
                          modifierKind: 'ROLL_INFLUENCE',
                          payload: { influence: 'DISADVANTAGE' },
                          scope: 'GLOBAL',
                          selectionKind: 'GRANTED',
                          order: 1
                        },
                        {
                          id: S.actionId(306, 903),
                          grantKind: 'MODIFIER_GRANT',
                          valueDomainCode: 'SAVING_THROW_MODIFIER',
                          domain: { ability: S.ABILITY_CODE.STRENGTH },
                          modifierKind: 'ROLL_INFLUENCE',
                          payload: { influence: 'DISADVANTAGE' },
                          scope: 'GLOBAL',
                          selectionKind: 'GRANTED',
                          order: 2
                        },
                        {
                          id: S.actionId(306, 904),
                          grantKind: 'MODIFIER_GRANT',
                          valueDomainCode: 'ATTACK_ROLL',
                          domain: { attackDomain: 'MELEE', ability: S.ABILITY_CODE.STRENGTH },
                          modifierKind: 'ROLL_INFLUENCE',
                          payload: { influence: 'DISADVANTAGE' },
                          scope: 'GLOBAL',
                          selectionKind: 'GRANTED',
                          order: 3
                        },
                        {
                          id: S.actionId(306, 905),
                          grantKind: 'MODIFIER_GRANT',
                          valueDomainCode: 'ATTACK_ROLL',
                          domain: { attackDomain: 'RANGED', ability: S.ABILITY_CODE.STRENGTH },
                          modifierKind: 'ROLL_INFLUENCE',
                          payload: { influence: 'DISADVANTAGE' },
                          scope: 'GLOBAL',
                          selectionKind: 'GRANTED',
                          order: 4
                        },
                        {
                          id: S.actionId(306, 906),
                          grantKind: 'MODIFIER_GRANT',
                          valueDomainCode: 'ATTACK_ROLL',
                          domain: { attackDomain: 'UNARMED', ability: S.ABILITY_CODE.STRENGTH },
                          modifierKind: 'ROLL_INFLUENCE',
                          payload: { influence: 'DISADVANTAGE' },
                          scope: 'GLOBAL',
                          selectionKind: 'GRANTED',
                          order: 5
                        }
                      ]
                    }
                  },
                  {
                    id: S.actionId(306, 236),
                    effectKind: S.EFFECT_KIND.FOLLOW_UP_SAVE,
                    timing: 'TARGET_TURN_END',
                    savingThrow: {
                      id: S.actionId(306, 237),
                      dcMethod: 'FIXED_DC',
                      abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.STRENGTH,
                      baseDc: 17
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
      order: 2
    },
    {
      id: S.featureId(306, 3),
      label: 'Multiattack',
      description:
        'Multiattack. The dragon makes three attacks: one with its bite and two with its claws.',
      attackSlots: {
        alternatives: [
          {
            slots: [
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(306, 4) }] },
              { count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(306, 5) }] }
            ]
          }
        ]
      },
      order: 3
    },
    {
      id: S.featureId(306, 4),
      label: 'Bite',
      description:
        'Bite. Melee Weapon Attack: +10 to hit, reach 10 ft., one target. Hit: 17 (2d10 + 6) piercing damage.',
      effects: [
        {
          id: S.actionId(306, 213),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(306, 214),
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
              id: S.actionId(306, 215),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(306, 216),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(306, 217),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d10+6'
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
      id: S.featureId(306, 5),
      label: 'Claw',
      description:
        'Claw. Melee Weapon Attack: +10 to hit, reach 5 ft., one target. Hit: 13 (2d6 + 6) slashing damage.',
      effects: [
        {
          id: S.actionId(306, 218),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(306, 219),
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
              id: S.actionId(306, 220),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(306, 221),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(306, 222),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6+6'
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 5
    }
  ]
}
