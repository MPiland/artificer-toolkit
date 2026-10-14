import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'
export const cockatrice: CreatureAuthored = {
  id: S.CREATURE_IDS.COCKATRICE,
  label: 'Cockatrice',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.SMALL,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 6,
    DEXTERITY: 12,
    CONSTITUTION: 12,
    INTELLIGENCE: 2,
    WISDOM: 13,
    CHARISMA: 5
  },
  naturalArmorBonus: 0,
  hitPoints: 27,
  hitDice: {
    count: 6,
    die: 6,
    modifier: 6
  },
  speeds: [...S.walk(20), ...S.fly(40)],
  senses: [S.darkvision(60)],
  passivePerception: 11,
  challengeRatingId: S.CR.CR_1_2,
  xp: 100,
  features: [
    {
      id: S.featureId(67, 1),
      label: 'Bite',
      description:
        'Bite. Melee Weapon Attack: +3 to hit, reach 5 ft., one creature. Hit: 3 (1d4 + 1) piercing damage, and the target must succeed on a DC 11 Constitution saving throw against being magically petrified. On a failed save, the creature begins to turn to stone and is restrained. It must repeat the saving throw at the end of its next turn. On a success, the effect ends. On a failure, the creature is petrified for 24 hours.',
      effects: [
        {
          id: S.actionId(67, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(67, 2),
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
              id: S.actionId(67, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(67, 3) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(67, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d4+1'
                  },
                  {
                    id: S.actionId(67, 4),
                    effectKind: S.EFFECT_KIND.FOLLOW_UP_SAVE,
                    timing: S.FOLLOW_UP_SAVE_TIMING.IMMEDIATE,
                    savingThrow: {
                      id: S.actionId(67, 901),
                      dcMethod: 'FIXED_DC',
                      abilityDefinitionId: S.SRD_ABILITY_DEFINITION_IDS.CONSTITUTION,
                      baseDc: 11
                    },
                    attempts: { kind: 'ONCE' },
                    onSuccess: { kind: 'END' },
                    onFailure: {
                      kind: 'OUTCOMES',
                      endCurrent: false,
                      resultKind: 'SEQUENCE',
                      outcomes: [
                        {
                          id: S.actionId(67, 902),
                          effectKind: S.EFFECT_KIND.CONDITION,
                          conditionId: conditionTypeId('RESTRAINED')
                        },
                        {
                          id: S.actionId(67, 903),
                          effectKind: S.EFFECT_KIND.FOLLOW_UP_SAVE,
                          timing: S.FOLLOW_UP_SAVE_TIMING.TARGET_TURN_END,
                          savingThrow: {
                            id: S.actionId(67, 904),
                            dcMethod: 'FIXED_DC',
                            abilityDefinitionId: S.SRD_ABILITY_DEFINITION_IDS.CONSTITUTION,
                            baseDc: 11
                          },
                          attempts: { kind: 'ONCE' },
                          onSuccess: { kind: 'END' },
                          onFailure: {
                            kind: 'OUTCOMES',
                            endCurrent: true,
                            resultKind: 'SINGLE',
                            outcomes: [
                              {
                                id: S.actionId(67, 905),
                                effectKind: S.EFFECT_KIND.CONDITION,
                                conditionId: conditionTypeId('PETRIFIED')
                              }
                            ]
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 1
    }
  ]
}
