import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'
export const giantElk: CreatureAuthored = {
  id: S.CREATURE_IDS.GIANT_ELK,
  label: 'Giant Elk',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.HUGE,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 19,
    DEXTERITY: 16,
    CONSTITUTION: 14,
    INTELLIGENCE: 7,
    WISDOM: 14,
    CHARISMA: 10
  },
  naturalArmorBonus: 1,
  hitPoints: 42,
  hitDice: {
    count: 5,
    die: 12,
    modifier: 10
  },
  speeds: [...S.walk(60)],
  proficiencies: [
    S.grantedSkillProficiency(122, 1, 'PERCEPTION'),
    S.grantedLanguageProficiency(122, 2, 'GIANT_ELK')
  ],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_2,
  xp: 450,
  features: [
    {
      id: S.featureId(122, 1),
      label: 'Charge',
      description:
        'Charge. If the elk moves at least 20 feet straight toward a target and then hits it with a ram attack on the same turn, the target takes an extra 7 (2d6) damage. If the target is a creature, it must succeed on a DC 14 Strength saving throw or be knocked prone.',
      effects: [
        {
          id: S.actionId(122, 201),
          order: 1,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            range: {
              id: S.actionId(122, 1202),
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
              id: S.actionId(122, 202),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(122, 203),
                resultKind: 'SEQUENCE',
                outcomes: [
                  {
                    id: S.actionId(122, 204),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6'
                  },
                  {
                    id: S.actionId(122, 205),
                    effectKind: S.EFFECT_KIND.FOLLOW_UP_SAVE,
                    timing: S.FOLLOW_UP_SAVE_TIMING.IMMEDIATE,
                    savingThrow: {
                      id: S.actionId(122, 206),
                      dcMethod: 'FIXED_DC',
                      abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.STRENGTH,
                      baseDc: 14
                    },
                    attempts: { kind: 'ONCE' },
                    onSuccess: { kind: 'END' },
                    onFailure: {
                      kind: 'OUTCOMES',
                      endCurrent: false,
                      resultKind: 'SINGLE',
                      outcomes: [
                        {
                          id: S.actionId(122, 207),
                          effectKind: S.EFFECT_KIND.CONDITION,
                          conditionId: conditionTypeId('PRONE')
                        }
                      ]
                    }
                  },
                  {
                    id: S.actionId(122, 208),
                    effectKind: S.EFFECT_KIND.CLOSED_RULE,
                    ruleKind: S.CLOSED_RULE_KIND.CREATURE_GIANT_ELK_CHARGE_GATE
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 1
    },
    {
      id: S.featureId(122, 2),
      label: 'Language Limitation',
      description: "understands Common, Elvish, and Sylvan but can't speak them",
      grants: {
        proficiencies: [S.grantedLanguageProficiency(122, 3, 'COMMON', 'ELVISH', 'SYLVAN')]
      },
      order: 2
    },
    {
      id: S.featureId(122, 3),
      label: 'Ram',
      description:
        'Ram. Melee Weapon Attack: +6 to hit, reach 10 ft., one target. Hit: 11 (2d6 + 4) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(122, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(122, 2),
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
              id: S.actionId(122, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(122, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(122, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6+4'
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
      id: S.featureId(122, 4),
      label: 'Hooves',
      description:
        'Hooves. Melee Weapon Attack: +6 to hit, reach 5 ft., one prone creature. Hit: 22 (4d8 + 4) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(122, 4),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(122, 5),
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
              id: S.actionId(122, 6),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(122, 6) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(122, 6),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '4d8+4'
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 4
    }
  ]
}
