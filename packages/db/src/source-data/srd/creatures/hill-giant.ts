import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const hillGiant: CreatureAuthored = {
  id: S.CREATURE_IDS.HILL_GIANT,
  label: 'Hill Giant',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.GIANT,
  size: S.SIZE_CODE.HUGE,
  alignmentId: '00000000-0000-0000-0001-000900000000',
  abilityScores: {
    STRENGTH: 21,
    DEXTERITY: 8,
    CONSTITUTION: 19,
    INTELLIGENCE: 5,
    WISDOM: 9,
    CHARISMA: 6
  },
  armorClass: 13,
  armorClassNote: 'natural armor',
  hitPoints: 105,
  hitDice: {
    count: 10,
    die: 12,
    modifier: 40
  },
  speeds: [...S.walk(40)],
  proficiencies: [
    S.grantedSkillProficiency(163, 1, 'PERCEPTION'),
    S.grantedLanguageProficiency(163, 2, 'GIANT')
  ],
  passivePerception: 12,
  challengeRatingId: S.CR.CR_5,
  xp: 1800,
  features: [
    {
      id: S.featureId(163, 1),
      label: 'Multiattack',
      description: 'The giant makes two greatclub attacks.',
      order: 1
    },
    {
      id: S.featureId(163, 2),
      label: 'Greatclub',
      description:
        'Melee Weapon Attack: +8 to hit, reach 10 ft., one target. Hit: 18 (3d8 + 5) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(163, 4),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(163, 5),
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
              id: S.actionId(163, 6),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(163, 6) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(163, 6),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '3d8',
                    bonuses: [
                      {
                        id: S.actionId(163, 7),
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
      id: S.featureId(163, 3),
      label: 'Rock',
      description:
        'Ranged Weapon Attack: +8 to hit, range 60/240 ft., one target. Hit: 21 (3d10 + 5) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(163, 8),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(163, 9),
              rangeKind: S.RANGE_KIND.SPECIAL
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(163, 10),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(163, 10) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(163, 10),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '3d10',
                    bonuses: [
                      {
                        id: S.actionId(163, 11),
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
