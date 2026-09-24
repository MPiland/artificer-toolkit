import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import { conditionTypeId } from '../equipment/shared.js'
import { SRD_BREATHING_CAPABILITY_DEFINITION_ID } from '../ruleState.js'
import * as S from './shared.js'
export const rugOfSmothering: CreatureAuthored = {
  id: S.CREATURE_IDS.RUG_OF_SMOTHERING,
  label: 'Rug Of Smothering',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.CONSTRUCT,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 17,
    DEXTERITY: 14,
    CONSTITUTION: 10,
    INTELLIGENCE: 1,
    WISDOM: 3,
    CHARISMA: 1
  },
  armorClass: 12,
  hitPoints: 33,
  hitDice: {
    count: 6,
    die: 8,
    modifier: 6
  },
  speeds: [...S.walk(10)],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_2,
  xp: 450,
  features: [
    {
      id: S.featureId(240, 1),
      label: 'False Appearance',
      description:
        'False Appearance. While the rug remains motionless, it is indistinguishable from a normal rug.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(240, 501),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(240, 601), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_RUG_OF_SMOTHERING_FALSE_APPEARANCE
        })
      ],
      order: 1
    },
    {
      id: S.featureId(240, 2),
      label: 'Smother',
      description:
        "Smother. Melee Weapon Attack: +5 to hit, reach 5 ft., one Medium or smaller creature. Hit: The creature is grappled (escape DC 13). Until this grapple ends, the target is restrained, blinded, and at risk of suffocating, and the rug can't smother another target. In addition, at the start of each of the target's turns, the target takes 10 (2d6 + 3) bludgeoning damage.",
      effects: [
        {
          id: S.actionId(7705, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(7705, 2),
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
              id: S.actionId(7705, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(7705, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(7705, 3),
                    effectKind: S.EFFECT_KIND.ACTOR_RELATIONSHIP,
                    modules: [
                      {
                        id: S.actionId(7705, 4),
                        order: 1,
                        kind: 'TARGET_SIZE_MAXIMUM',
                        sizeCode: S.SIZE_CODE.MEDIUM
                      },
                      {
                        id: S.actionId(7705, 5),
                        order: 2,
                        kind: 'SOURCE_EXCLUSIVE_TARGET',
                        maximum: 1
                      },
                      {
                        id: S.actionId(7705, 6),
                        order: 3,
                        kind: 'SOURCE_ACTION_TARGET_RESTRICTION',
                        actionEffectIds: [S.actionId(7705, 1)]
                      },
                      {
                        id: S.actionId(7705, 7),
                        order: 4,
                        kind: 'ESCAPE_CHECK',
                        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                        abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.STRENGTH,
                        fixedDc: 13,
                        actorKinds: ['TARGET']
                      },
                      {
                        id: S.actionId(7705, 8),
                        order: 5,
                        kind: 'TARGET_CAPABILITY_SUPPRESSION',
                        capabilityDefinitionIds: [SRD_BREATHING_CAPABILITY_DEFINITION_ID]
                      }
                    ],
                    conditions: [
                      {
                        id: S.actionId(7705, 9),
                        effectKind: S.EFFECT_KIND.CONDITION,
                        conditionId: conditionTypeId('GRAPPLED')
                      },
                      {
                        id: S.actionId(7705, 10),
                        effectKind: S.EFFECT_KIND.CONDITION,
                        conditionId: conditionTypeId('RESTRAINED')
                      },
                      {
                        id: S.actionId(7705, 11),
                        effectKind: S.EFFECT_KIND.CONDITION,
                        conditionId: conditionTypeId('BLINDED')
                      }
                    ],
                    recurrence: {
                      stage: 'START_OF_TURN',
                      damage: {
                        id: S.actionId(7705, 12),
                        effectKind: S.EFFECT_KIND.DAMAGE,
                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                        scalingKind: S.SCALING.NONE,
                        diceConfig: '2d6+3'
                      }
                    }
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 2
    }
  ]
}
