import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import { DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import { SRD_BREATHING_CAPABILITY_DEFINITION_ID } from '../ruleState.js'
import * as S from './shared.js'
export const cloaker: CreatureAuthored = {
  id: S.CREATURE_IDS.CLOAKER,
  label: 'Cloaker',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.ABERRATION,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000600000000',
  abilityScores: {
    STRENGTH: 17,
    DEXTERITY: 15,
    CONSTITUTION: 12,
    INTELLIGENCE: 13,
    WISDOM: 12,
    CHARISMA: 14
  },
  naturalArmorBonus: 2,
  hitPoints: 78,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 12,
    die: 10,
    modifier: 12
  },
  speeds: [...S.walk(10), ...S.fly(40)],
  proficiencies: [
    S.grantedLanguageProficiency(9141, 2, 'DEEP_SPEECH', 'UNDERCOMMON'),
    S.grantedSkillProficiency(9141, 1, 'STEALTH')
  ],
  senses: [S.darkvision(60)],
  passivePerception: 11,
  challengeRatingId: S.CR.CR_8,
  xp: 3900,
  features: [
    {
      id: S.featureId(65, 1),
      label: 'Damage Transfer',
      description:
        'Damage Transfer. While attached to a creature, the cloaker takes only half the damage dealt to it (rounded down), and that creature takes the other half.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(65, 101),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(65, 102), rangeKind: S.RANGE_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_CLOAKER_DAMAGE_TRANSFER
        })
      ],
      order: 1
    },
    {
      id: S.featureId(65, 2),
      label: 'False Appearance',
      description:
        'False Appearance. While the cloaker remains motionless without its underside exposed, it is indistinguishable from a dark leather cloak.',
      order: 2
    },
    {
      id: S.featureId(65, 3),
      label: 'Light Sensitivity',
      description:
        'Light Sensitivity. While in bright light, the cloaker has disadvantage on attack rolls and Wisdom (Perception) checks that rely on sight.',
      grants: S.lightSensitivityGrants(65, 100, false),
      order: 3
    },
    {
      id: S.featureId(65, 4),
      label: 'Moan',
      description:
        "Moan. Each creature within 60 feet of the cloaker that can hear its moan and that isn't an aberration must succeed on a DC 13 Wisdom saving throw or become frightened until the end of the cloaker's next turn. If a creature's saving throw is successful, the creature is immune to the cloaker's moan for the next 24 hours",
      effects: [
        {
          id: S.actionId(65, 107),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(65, 108),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM,
              baseDc: 13
            },
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(65, 109), rangeKind: S.RANGE_KIND.SELF },
            shape: {
              id: S.actionId(65, 127),
              shapeKind: 'SPHERE',
              radius: { amount: 60, unit: S.MEASUREMENT_UNIT_CODE.FEET }
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.AREA_CONTENTS,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY,
              excludedCreatureTypeIds: [S.CREATURE_TYPE.ABERRATION]
            }
          },
          paths: [
            {
              id: S.actionId(65, 110),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${S.actionId(65, 110)}__result`,
                resultKind: 'SEQUENCE',
                duration: {
                  id: S.actionId(65, 111),
                  durationKind: DURATION_KIND.ROUND,
                  amount: 1
                },
                outcomes: [
                  {
                    id: S.actionId(65, 112),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('FRIGHTENED'),
                    recordsSource: true
                  }
                ]
              }
            },
            S.saveImmunityPath(65, 128)
          ]
        }
      ],
      order: 4
    },
    {
      id: S.featureId(65, 5),
      label: 'Phantasms (Recharges after a Short or Long Rest)',
      description:
        "Phantasms (Recharges after a Short or Long Rest). The cloaker magically creates three illusory duplicates of itself if it isn't in bright light. The duplicates move with it and mimic its actions, shifting position so as to make it impossible to track which cloaker is the real one. If the cloaker is ever in an area of bright light, the duplicates disappear. Whenever any creature targets the cloaker with an attack or a harmful spell while a duplicate remains, that creature rolls randomly to determine whether it targets the cloaker or one of the duplicates. A creature is unaffected by this magical effect if it can't see or if it relies on senses other than sight. A duplicate has the cloaker's AC and uses its saving throws. If an attack hits a duplicate, or if a duplicate fails a saving throw against an effect that deals damage, the duplicate disappears.",
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.actionId(65, 116),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.SHORT_REST,
        amount: 1
      },
      effects: [
        {
          id: S.actionId(65, 117),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(65, 118), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          paths: [
            {
              id: S.actionId(65, 119),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${S.actionId(65, 119)}__result`,
                resultKind: 'SEQUENCE',
                outcomes: [
                  {
                    id: S.actionId(65, 120),
                    effectKind: S.EFFECT_KIND.MANIFEST,
                    manifestKind: 'ILLUSION',
                    label: 'Cloaker Phantasms',
                    attachmentKind: 'SOURCE',
                    components: [1, 2, 3].map((order) => ({
                      id: S.actionId(65, 120 + order),
                      order,
                      label: `Illusory Duplicate ${order}`,
                      armorClass: 14
                    }))
                  },
                  {
                    id: S.actionId(65, 124),
                    effectKind: S.EFFECT_KIND.CLOSED_RULE,
                    ruleKind: S.CLOSED_RULE_KIND.CREATURE_CLOAKER_PHANTASMS
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
      id: S.featureId(65, 6),
      label: 'Multiattack',
      description:
        'Multiattack. The cloaker makes two attacks: one with its bite and one with its tail.',
      attackSlots: {
        alternatives: [
          {
            slots: [
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(65, 7) }] },
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(65, 8) }] }
            ]
          }
        ]
      },
      order: 6
    },
    {
      id: S.featureId(65, 7),
      label: 'Bite',
      description:
        "Bite. Melee Weapon Attack: +6 to hit, reach 5 ft., one creature. Hit: 10 (2d6 + 3) piercing damage, and if the target is Large or smaller, the cloaker attaches to it. If the cloaker has advantage against the target, the cloaker attaches to the target's head, and the target is blinded and unable to breathe while the cloaker is attached. While attached, the cloaker can make this attack only against the target and has advantage on the attack roll. The cloaker can detach itself by spending 5 feet of its movement. A creature, including the target, can take its action to detach the cloaker by succeeding on a DC 16 Strength check.",
      effects: [
        {
          id: S.actionId(9141, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(9141, 2),
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
              id: S.actionId(9141, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(9141, 3) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(9141, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6',
                    bonuses: [
                      {
                        id: S.actionId(9141, 4),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.STRENGTH,
                        order: 1
                      }
                    ]
                  },
                  {
                    id: S.actionId(9141, 105),
                    effectKind: S.EFFECT_KIND.ACTOR_RELATIONSHIP,
                    heldAtOnce: 1,
                    modules: [
                      {
                        id: S.actionId(9141, 106),
                        order: 1,
                        kind: 'TARGET_SIZE_MAXIMUM',
                        sizeCode: S.SIZE_CODE.LARGE
                      },
                      {
                        id: S.actionId(9141, 107),
                        order: 2,
                        kind: 'SOURCE_ACTION_TARGET_RESTRICTION',
                        actionEffectIds: [S.actionId(9141, 1)]
                      },
                      {
                        id: S.actionId(9141, 108),
                        order: 3,
                        kind: 'SOURCE_ATTACK_ROLL_INFLUENCE',
                        actionEffectIds: [S.actionId(9141, 1)],
                        influence: 'ADVANTAGE'
                      },
                      { id: S.actionId(9141, 109), order: 4, kind: 'SOURCE_FOLLOWS_TARGET' },
                      {
                        id: S.actionId(9141, 110),
                        order: 5,
                        kind: 'SOURCE_RELEASE_MOVEMENT_COST',
                        amount: 5,
                        unit: S.MEASUREMENT_UNIT_CODE.FEET
                      },
                      {
                        id: S.actionId(9141, 111),
                        order: 6,
                        kind: 'ESCAPE_CHECK',
                        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                        checks: {
                          skillIds: [],
                          abilityDefinitionIds: [SRD_EFFECT_ABILITY_DEFINITION_IDS.STRENGTH]
                        },
                        dc: { kind: 'FIXED', value: 16 },
                        actorKinds: ['TARGET', 'CREATURE_WITHIN_REACH']
                      },
                      {
                        id: S.actionId(9141, 112),
                        order: 7,
                        kind: 'CONDITIONAL_TARGET_STATE',
                        whenResolvedAttackD20Mode: 'ADVANTAGE',
                        conditionIds: [conditionTypeId('BLINDED')],
                        capabilityDefinitionIds: [SRD_BREATHING_CAPABILITY_DEFINITION_ID]
                      }
                    ]
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
      id: S.featureId(65, 8),
      label: 'Tail',
      description:
        'Tail. Melee Weapon Attack: +6 to hit, reach 10 ft., one creature. Hit: 7 (1d8 + 3) slashing damage.',
      effects: [
        {
          id: S.actionId(9141, 5),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(9141, 6),
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
              id: S.actionId(9141, 7),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(9141, 7) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(9141, 7),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d8',
                    bonuses: [
                      {
                        id: S.actionId(9141, 8),
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
      order: 8
    }
  ]
}
