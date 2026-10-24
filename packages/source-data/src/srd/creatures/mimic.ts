import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CHANGE_SHAPE_RULING } from './changeShapeRuling.js'
import * as S from './shared.js'
export const mimic: CreatureAuthored = {
  id: S.CREATURE_IDS.MIMIC,
  label: 'Mimic',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000500000000',
  tags: ['shapechanger'],
  abilityScores: {
    STRENGTH: 17,
    DEXTERITY: 12,
    CONSTITUTION: 15,
    INTELLIGENCE: 5,
    WISDOM: 13,
    CHARISMA: 8
  },
  naturalArmorBonus: 1,
  hitPoints: 58,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 9,
    die: 8,
    modifier: 18
  },
  speeds: [...S.walk(15)],
  proficiencies: [S.grantedSkillExpertise(10197, 1, 'STEALTH')],
  damageImmunities: ['acid'],
  conditionImmunities: ['prone'],
  senses: [S.darkvision(60)],
  passivePerception: 11,
  challengeRatingId: S.CR.CR_2,
  xp: 450,
  features: [
    {
      id: S.featureId(197, 1),
      label: 'Shapechanger',
      description:
        "Shapechanger. The mimic can use its action to polymorph into an object or back into its true, amorphous form. Its statistics are the same in each form. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.",
      effects: [
        S.manualAdjudicationEffect({
          id: S.actionId(197, 501),
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(197, 601), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ...CHANGE_SHAPE_RULING.OBJECT_FORM
        })
      ],
      order: 1
    },
    {
      id: S.featureId(197, 2),
      label: 'Adhesive (Object Form Only)',
      description:
        'Adhesive (Object Form Only). The mimic adheres to anything that touches it. A Huge or smaller creature adhered to the mimic is also grappled by it (escape DC 13). Ability checks made to escape this grapple have disadvantage.',
      order: 2
    },
    {
      id: S.featureId(197, 3),
      label: 'False Appearance (Object Form Only)',
      description:
        'False Appearance (Object Form Only). While the mimic remains motionless, it is indistinguishable from an ordinary object.',
      order: 3
    },
    {
      id: S.featureId(197, 4),
      label: 'Grappler',
      description:
        'Grappler. The mimic has advantage on attack rolls against any creature grappled by it.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(197, 504),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            range: { id: S.actionId(197, 604), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          pathCode: S.PATH_CODE.ON_HIT,
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_MIMIC_GRAPPLER
        })
      ],
      order: 4
    },
    {
      id: S.featureId(197, 5),
      label: 'Pseudopod',
      description:
        'Pseudopod. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) bludgeoning damage. If the mimic is in object form, the target is subjected to its Adhesive trait.',
      effects: [
        {
          id: S.actionId(197, 3),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(197, 4),
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
              id: S.actionId(197, 5),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(197, 5) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(197, 5),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d8',
                    bonuses: [
                      {
                        id: S.actionId(197, 6),
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
        },
        S.closedRuleEffect({
          id: S.actionId(197, 505),
          order: 2,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(197, 605),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 5,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          pathCode: S.PATH_CODE.ON_HIT,
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_MIMIC_PSEUDOPOD_ADHESIVE
        })
      ],
      order: 5
    },
    {
      id: S.featureId(197, 6),
      label: 'Bite',
      description:
        'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) piercing damage plus 4 (1d8) acid damage.',
      effects: [
        {
          id: S.actionId(197, 8),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(197, 9),
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
              id: S.actionId(197, 10),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(197, 10) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(197, 10),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d8',
                    bonuses: [
                      {
                        id: S.actionId(197, 11),
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
              id: S.actionId(197, 12),
              order: 2,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(197, 12) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(197, 12),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('ACID'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d8'
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 6
    }
  ]
}
