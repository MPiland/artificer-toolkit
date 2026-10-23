import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const roper: CreatureAuthored = {
  id: S.CREATURE_IDS.ROPER,
  label: 'Roper',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000800000000',
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 8,
    CONSTITUTION: 17,
    INTELLIGENCE: 7,
    WISDOM: 16,
    CHARISMA: 6
  },
  naturalArmorBonus: 11,
  hitPoints: 93,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 11,
    die: 10,
    modifier: 33
  },
  speeds: [...S.walk(10), ...S.climb(10)],
  proficiencies: [
    S.grantedSkillExpertise(7072, 2, 'STEALTH'),
    S.grantedSkillProficiency(7072, 1, 'PERCEPTION')
  ],
  senses: [S.darkvision(60)],
  passivePerception: 16,
  challengeRatingId: S.CR.CR_5,
  xp: 1800,
  features: [
    {
      id: S.featureId(239, 1),
      label: 'False Appearance',
      description:
        'False Appearance. While the roper remains motionless, it is indistinguishable from a normal cave formation, such as a stalagmite.',
      order: 1
    },
    {
      id: S.featureId(239, 2),
      label: 'Grasping Tendrils',
      description:
        'Grasping Tendrils. The roper can have up to six tendrils at a time. Each tendril can be attacked (AC 20; 10 hit points; immunity to poison and psychic damage). Destroying a tendril deals no damage to the roper, which can extrude a replacement tendril on its next turn. A tendril can also be broken if a creature takes an action and succeeds on a DC 15 Strength check against it.',
      order: 2
    },
    {
      id: S.featureId(239, 3),
      label: 'Spider Climb',
      description:
        'Spider Climb. The roper can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(239, 503),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(239, 603), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_SPIDER_CLIMB
        })
      ],
      order: 3
    },
    {
      id: S.featureId(239, 4),
      label: 'Multiattack',
      description:
        'Multiattack. The roper makes four attacks with its tendrils, uses Reel, and makes one attack with its bite.',
      attackSlots: {
        alternatives: [
          {
            slots: [
              { count: 4, fillers: [{ kind: 'FEATURE', featureId: S.featureId(239, 6) }] },
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(239, 7) }] },
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(239, 5) }] }
            ]
          }
        ]
      },
      order: 4
    },
    {
      id: S.featureId(239, 5),
      label: 'Bite',
      description:
        'Bite. Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 22 (4d8 + 4) piercing damage.',
      effects: [
        {
          id: S.actionId(7072, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(7072, 2),
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
              id: S.actionId(7072, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(7072, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(7072, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '4d8',
                    bonuses: [
                      {
                        id: S.actionId(7072, 4),
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
      id: S.featureId(239, 6),
      label: 'Tendril',
      description:
        "Tendril. Melee Weapon Attack: +7 to hit, reach 50 ft., one creature. Hit: The target is grappled (escape DC 15). Until the grapple ends, the target is restrained and has disadvantage on Strength checks and Strength saving throws, and the roper can't use the same tendril on another target.",
      effects: [
        {
          id: S.actionId(7072, 5),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(7072, 6),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 50,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(7072, 7),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(7072, 7) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  S.grappledOutcome(239, {
                    localIndex: 1,
                    escapeDc: 15,
                    heldAtOnce: 6,
                    untilEnds: ['RESTRAINED']
                  })
                ]
              }
            }
          ]
        },
        S.closedRuleEffect({
          id: S.actionId(239, 505),
          order: 2,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(239, 605),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 50,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          pathCode: S.PATH_CODE.ON_HIT,
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_ROPER_TENDRIL
        })
      ],
      order: 6
    },
    {
      id: S.featureId(239, 7),
      label: 'Reel',
      description:
        'Reel. The roper pulls each creature grappled by it up to 25 feet straight toward it.',
      effects: [
        {
          id: S.actionId(7072, 9),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(7072, 10),
              rangeKind: S.RANGE_KIND.SPECIAL
            }
          },
          paths: [
            {
              id: S.actionId(7072, 11),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(7072, 11) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(7072, 11),
                    effectKind: S.EFFECT_KIND.CLOSED_RULE,
                    ruleKind: 'ROPER_REEL' as const
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 7
    }
  ]
}
