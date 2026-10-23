import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CR, CREATURE_IDS, CREATURE_TYPE, SRD_SYSTEM_ID, SRD_USER_ID, walk } from './shared.js'
import { SRD_BASIC_ACTION_IDS } from '../basicActions.js'
import { standingGrantedActionsEffect } from '../closed-rule-effect.js'
import * as S from './shared.js'

export const orc: CreatureAuthored = {
  id: CREATURE_IDS.ORC,
  label: 'Orc',
  description: 'Medium humanoid (orc), chaotic evil',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'MONSTER',
  creatureTypeId: CREATURE_TYPE.HUMANOID,
  size: 'MEDIUM',
  alignmentId: '00000000-0000-0000-0001-000900000000',
  tags: ['orc'],
  abilityScores: {
    STRENGTH: 16,
    DEXTERITY: 12,
    CONSTITUTION: 16,
    INTELLIGENCE: 7,
    WISDOM: 11,
    CHARISMA: 10
  },
  naturalArmorBonus: 0,
  hitPoints: 15,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 2,
    die: 8,
    modifier: 6
  },
  speeds: walk(30),
  proficiencies: [
    S.grantedLanguageProficiency(212, 2, 'COMMON', 'ORC'),
    S.grantedSkillProficiency(212, 1, 'INTIMIDATION')
  ],
  senses: [S.darkvision(60)],
  passivePerception: 10,
  challengeRatingId: CR.CR_1_2,
  xp: 100,
  features: [
    {
      id: S.featureId(212, 1),
      label: 'Aggressive',
      description:
        'Aggressive. As a bonus action, the orc can move up to its speed toward a hostile creature that it can see.',
      effects: [
        // Moving up to its speed is a Dash; the "toward a hostile creature it can see" restriction has
        // no automated equivalent, so the Feature text states it.
        standingGrantedActionsEffect({
          id: S.bonusActionId(212, 501),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.bonusActionId(212, 601), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          grantedActions: [
            {
              activation: S.ACTIVATION_CODE.BONUS_ACTION,
              actionDefinitionIds: [SRD_BASIC_ACTION_IDS.DASH]
            }
          ]
        })
      ],
      order: 1
    },
    {
      id: S.featureId(212, 2),
      label: 'Greataxe',
      description:
        'Greataxe. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 9 (1d12 + 3) slashing damage.',
      effects: [
        {
          id: S.actionId(212, 501),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(212, 601),
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
              id: S.actionId(212, 801),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(212, 801) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(212, 910),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d12',
                    bonuses: [
                      {
                        id: S.actionId(212, 960),
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
      order: 2
    },
    {
      id: S.featureId(212, 3),
      label: 'Javelin',
      description:
        'Javelin. Melee or Ranged Weapon Attack: +5 to hit, reach 5 ft. or range 30/120 ft., one target. Hit: 6 (1d6 + 3) piercing damage.',
      effects: [
        {
          id: S.actionId(212, 502),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(212, 602),
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
              id: S.actionId(212, 802),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(212, 802) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(212, 920),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6',
                    bonuses: [
                      {
                        id: S.actionId(212, 970),
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
        {
          id: S.actionId(212, 512),
          order: 2,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(212, 612),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 30,
              longAmount: 120,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(212, 812),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(212, 812) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(212, 1020),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6',
                    bonuses: [
                      {
                        id: S.actionId(212, 1070),
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
    }
  ]
}
