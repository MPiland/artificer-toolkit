import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'
export const minotaurSkeleton: CreatureAuthored = {
  id: S.CREATURE_IDS.MINOTAUR_SKELETON,
  label: 'Minotaur Skeleton',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.UNDEAD,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000700000000',
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 11,
    CONSTITUTION: 15,
    INTELLIGENCE: 6,
    WISDOM: 8,
    CHARISMA: 5
  },
  naturalArmorBonus: 2,
  hitPoints: 67,
  hitDice: {
    count: 9,
    die: 10,
    modifier: 18
  },
  speeds: [...S.walk(40)],
  damageVulnerabilities: ['bludgeoning'],
  damageImmunities: ['poison'],
  conditionImmunities: ['exhaustion', 'poisoned'],
  senses: ['darkvision 60 ft.'],
  passivePerception: 9,
  challengeRatingId: S.CR.CR_2,
  xp: 450,
  features: [
    {
      id: S.featureId(199, 1),
      label: 'Charge',
      description:
        'Charge. If the skeleton moves at least 10 feet straight toward a target and then hits it with a gore attack on the same turn, the target takes an extra 9 (2d8) piercing damage. If the target is a creature, it must succeed on a DC 14 Strength saving throw or be pushed up to 10 feet away and knocked prone.',
      effects: [
        {
          id: S.actionId(199, 501),
          order: 1,
          invocation: {
            kind: 'PASSIVE' as const,
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(199, 601),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.STRENGTH,
              baseDc: 14
            },
            range: {
              id: S.actionId(199, 602),
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
              id: S.actionId(199, 801),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(199, 801) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(199, 910),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d8'
                  },
                  {
                    id: S.actionId(199, 911),
                    effectKind: S.EFFECT_KIND.FORCED_MOVEMENT,
                    direction: 'AWAY_FROM_SOURCE' as const,
                    actionEconomy: 'NONE' as const,
                    distanceMode: 'FIXED_DISTANCE' as const,
                    amount: 10,
                    unit: S.MEASUREMENT_UNIT_CODE.FEET
                  },
                  {
                    id: S.actionId(199, 912),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('PRONE')
                  },
                  {
                    id: S.actionId(199, 918),
                    effectKind: S.EFFECT_KIND.CLOSED_RULE,
                    ruleKind: S.CLOSED_RULE_KIND.CREATURE_MINOTAUR_SKELETON_CHARGE
                  }
                ]
              }
            },
            {
              id: S.actionId(199, 802),
              order: 2,
              pathCode: S.PATH_CODE.ON_SAVE_SUCCESS,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(199, 802) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(199, 920),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d8'
                  },
                  {
                    id: S.actionId(199, 928),
                    effectKind: S.EFFECT_KIND.CLOSED_RULE,
                    ruleKind: S.CLOSED_RULE_KIND.CREATURE_MINOTAUR_SKELETON_CHARGE
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
      id: S.featureId(199, 2),
      label: 'Language Limitation',
      description: "understands Abyssal but can't speak",
      grants: {
        proficiencies: [S.grantedLanguageProficiency(199, 1, 'ABYSSAL')]
      },
      order: 2
    },
    {
      id: S.featureId(199, 3),
      label: 'Greataxe',
      description:
        'Greataxe. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 17 (2d12 + 4) slashing damage.',
      effects: [
        {
          id: S.actionId(199, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(199, 2),
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
              id: S.actionId(199, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(199, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(199, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d12',
                    bonuses: [
                      {
                        id: S.actionId(199, 4),
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
      id: S.featureId(199, 4),
      label: 'Gore',
      description:
        'Gore. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 13 (2d8 + 4) piercing damage.',
      effects: [
        {
          id: S.actionId(199, 5),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(199, 6),
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
              id: S.actionId(199, 7),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(199, 7) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(199, 7),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d8',
                    bonuses: [
                      {
                        id: S.actionId(199, 8),
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
    }
  ]
}
