import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const tiger: CreatureAuthored = {
  id: S.CREATURE_IDS.TIGER,
  label: 'Tiger',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 17,
    DEXTERITY: 15,
    CONSTITUTION: 14,
    INTELLIGENCE: 3,
    WISDOM: 12,
    CHARISMA: 8
  },
  naturalArmorBonus: 0,
  hitPoints: 37,
  hitDice: {
    count: 5,
    die: 10,
    modifier: 10
  },
  speeds: [...S.walk(40)],
  proficiencies: [
    S.grantedSkillExpertise(270, 2, 'STEALTH'),
    S.grantedSkillProficiency(270, 1, 'PERCEPTION')
  ],
  senses: ['darkvision 60 ft.'],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_1,
  xp: 200,
  features: [
    {
      id: S.featureId(270, 1),
      label: 'Keen Smell',
      description:
        'Keen Smell. The tiger has advantage on Wisdom (Perception) checks that rely on smell.',
      order: 1
    },
    {
      id: S.featureId(270, 2),
      label: 'Pounce',
      description:
        'Pounce. If the tiger moves at least 20 feet straight toward a creature and then hits it with a claw attack on the same turn, that target must succeed on a DC 13 Strength saving throw or be knocked prone. If the target is prone, the tiger can make one bite attack against it as a bonus action.',
      order: 2
    },
    {
      id: S.featureId(270, 3),
      label: 'Bite',
      description:
        'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 8 (1d10 + 3) piercing damage.',
      effects: [
        {
          id: S.actionId(270, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(270, 2),
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
              id: S.actionId(270, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(270, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(270, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d10',
                    bonuses: [
                      {
                        id: S.actionId(270, 4),
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
      id: S.featureId(270, 4),
      label: 'Claw',
      description:
        'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) slashing damage.',
      effects: [
        {
          id: S.actionId(270, 5),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(270, 6),
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
              id: S.actionId(270, 7),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(270, 7) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(270, 7),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d8',
                    bonuses: [
                      {
                        id: S.actionId(270, 8),
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
