import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'
export const purpleWorm: CreatureAuthored = {
  id: S.CREATURE_IDS.PURPLE_WORM,
  label: 'Purple Worm',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.GARGANTUAN,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 28,
    DEXTERITY: 7,
    CONSTITUTION: 22,
    INTELLIGENCE: 1,
    WISDOM: 8,
    CHARISMA: 4
  },
  armorClass: 18,
  armorClassNote: 'natural armor',
  hitPoints: 247,
  hitDice: {
    count: 15,
    die: 20,
    modifier: 90
  },
  speeds: [...S.walk(0), ...S.burrow(50)],
  senses: ['blindsight 30 ft.', 'tremorsense 60 ft.'],
  passivePerception: 9,
  challengeRatingId: S.CR.CR_15,
  xp: 13000,
  features: [
    {
      id: S.featureId(227, 1),
      label: 'Tunneler',
      description:
        'Tunneler. The worm can burrow through solid rock at half its Burrow Speed and leaves a 10-foot-diameter tunnel in its wake.',
      order: 1
    },
    {
      id: S.featureId(227, 2),
      label: 'Multiattack',
      description: 'Multiattack. The worm makes one Bite attack and one Tail Stinger attack.',
      order: 2
    },
    {
      id: S.featureId(227, 3),
      label: 'Bite',
      description:
        'Bite. Melee Attack Roll: +14, reach 10 ft. Hit: 22 (3d8 + 9) piercing damage. If the target is a Large or smaller creature, it has the grappled condition (escape DC 19), and it has the restrained condition until the grapple ends.',
      effects: [
        {
          id: S.actionId(7604, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(7604, 2),
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
              id: S.actionId(7604, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(7604, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(7604, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '3d8',
                    bonuses: [
                      {
                        id: S.actionId(7604, 4),
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
              id: S.actionId(7604, 5),
              order: 2,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(7604, 5) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(7604, 5),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('GRAPPLED')
                  }
                ]
              }
            },
            {
              id: S.actionId(7604, 6),
              order: 3,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(7604, 6) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(7604, 6),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('RESTRAINED')
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
      id: S.featureId(227, 4),
      label: 'Tail Stinger',
      description:
        'Tail Stinger. Melee Weapon Attack: +14 to hit, reach 10 ft., one creature. Hit: 19 (3d6 + 9) piercing damage, and the target must succeed on a DC 19 Constitution saving throw or become poisoned for 1 minute. While poisoned in this way, the target is unconscious. The target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success.',
      effects: [
        {
          id: S.actionId(7604, 7),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(7604, 8),
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
              id: S.actionId(7604, 9),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(7604, 9) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(7604, 9),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '3d6',
                    bonuses: [
                      {
                        id: S.actionId(7604, 10),
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
              id: S.actionId(7604, 11),
              order: 2,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(7604, 11) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(7604, 11),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('POISONED')
                  }
                ]
              }
            },
            {
              id: S.actionId(7604, 12),
              order: 3,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(7604, 12) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(7604, 12),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('UNCONSCIOUS')
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
      id: S.featureId(227, 5),
      label: 'Swallow',
      description:
        "Swallow. The worm makes one Bite attack against a Large or smaller creature it is grappling. If the attack hits, the target is swallowed, and the grapple ends. A swallowed creature is blinded and restrained, has total cover against attacks and other effects outside the worm, and takes 21 (6d6) acid damage at the start of each of the worm's turns. The worm can have only one creature swallowed at a time.",
      effects: [
        {
          id: S.actionId(7604, 13),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: {
              code: S.ACTIVATION_CODE.BONUS_ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(7604, 14),
              rangeKind: S.RANGE_KIND.SPECIAL
            }
          },
          paths: [
            {
              id: S.actionId(7604, 15),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(7604, 15) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(7604, 15),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION
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
