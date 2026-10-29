import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import {
  DURATION_KIND,
  MANIFEST_KIND,
  SHAPE_KIND,
  type CreatureAuthored
} from '@artificer-toolkit/shared'
import { SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '../concentration.js'
import { conditionTypeId } from '../equipment/shared.js'
import { SRD_BREATHING_CAPABILITY_DEFINITION_ID } from '../ruleState.js'
import * as S from './shared.js'
/** The 15-foot sphere of magical darkness around the darkmantle. */
const darknessAuraShape = (offset: number) => ({
  id: S.actionId(6527, offset),
  shapeKind: SHAPE_KIND.SPHERE,
  radius: { amount: 15, unit: S.MEASUREMENT_UNIT_CODE.FEET }
})

export const darkmantle: CreatureAuthored = {
  id: S.CREATURE_IDS.DARKMANTLE,
  label: 'Darkmantle',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.SMALL,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 16,
    DEXTERITY: 12,
    CONSTITUTION: 13,
    INTELLIGENCE: 2,
    WISDOM: 10,
    CHARISMA: 5
  },
  naturalArmorBonus: 0,
  hitPoints: 22,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 5,
    die: 6,
    modifier: 5
  },
  speeds: [...S.walk(10), ...S.fly(30)],
  proficiencies: [S.grantedSkillProficiency(6527, 1, 'STEALTH')],
  senses: [S.blindsight(60)],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_1_2,
  xp: 100,
  features: [
    {
      id: S.featureId(76, 1),
      label: 'Echolocation',
      description: "Echolocation. The darkmantle can't use its blindsight while deafened.",
      order: 1
    },
    {
      id: S.featureId(76, 2),
      label: 'False Appearance',
      description:
        'False Appearance. While the darkmantle remains motionless, it is indistinguishable from a cave formation such as a stalactite or stalagmite.',
      order: 2
    },
    {
      id: S.featureId(76, 4),
      label: 'Crush',
      description:
        "Crush. Melee Weapon Attack: +5 to hit, reach 5 ft., one creature. Hit: 6 (1d6 + 3) bludgeoning damage, and the darkmantle attaches to the target. If the target is Medium or smaller and the darkmantle has advantage on the attack roll, it attaches by engulfing the target's head, and the target is also blinded and unable to breathe while the darkmantle is attached in this way. While attached to the target, the darkmantle can attack no other creature except the target but has advantage on its attack rolls. The darkmantle's speed also becomes 0, it can't benefit from any bonus to its speed, and it moves with the target. A creature can detach the darkmantle by making a successful DC 13 Strength check as an action. On its turn, the darkmantle can detach itself from the target by using 5 feet of movement.",
      effects: [
        {
          id: S.actionId(6527, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(6527, 2),
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
              id: S.actionId(6527, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(6527, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(6527, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6',
                    bonuses: [
                      {
                        id: S.actionId(6527, 4),
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
              id: S.actionId(6527, 5),
              order: 2,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(6527, 5) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(6527, 5),
                    effectKind: S.EFFECT_KIND.ACTOR_RELATIONSHIP,
                    heldAtOnce: 1,
                    modules: [
                      {
                        id: S.actionId(6527, 105),
                        order: 1,
                        kind: 'SOURCE_ACTION_TARGET_RESTRICTION',
                        actionEffectIds: [S.actionId(6527, 1)]
                      },
                      {
                        id: S.actionId(6527, 106),
                        order: 2,
                        kind: 'SOURCE_ATTACK_ROLL_INFLUENCE',
                        actionEffectIds: [S.actionId(6527, 1)],
                        influence: 'ADVANTAGE'
                      },
                      { id: S.actionId(6527, 107), order: 3, kind: 'SOURCE_FOLLOWS_TARGET' },
                      {
                        id: S.actionId(6527, 108),
                        order: 4,
                        kind: 'SOURCE_RELEASE_MOVEMENT_COST',
                        amount: 5,
                        unit: S.MEASUREMENT_UNIT_CODE.FEET
                      },
                      {
                        id: S.actionId(6527, 109),
                        order: 5,
                        kind: 'ESCAPE_CHECK',
                        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                        checks: {
                          skillIds: [],
                          abilityDefinitionIds: [SRD_EFFECT_ABILITY_DEFINITION_IDS.STRENGTH]
                        },
                        dc: { kind: 'FIXED', value: 13 },
                        actorKinds: ['TARGET', 'CREATURE_WITHIN_REACH']
                      },
                      {
                        id: S.actionId(6527, 110),
                        order: 6,
                        kind: 'CONDITIONAL_TARGET_STATE',
                        whenResolvedAttackD20Mode: 'ADVANTAGE',
                        conditionIds: [conditionTypeId('BLINDED')],
                        capabilityDefinitionIds: [SRD_BREATHING_CAPABILITY_DEFINITION_ID]
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
    },
    {
      id: S.featureId(76, 5),
      label: 'Darkness Aura (1/Day)',
      description:
        "Darkness Aura (1/Day). A 15-foot radius of magical darkness extends out from the darkmantle, moves with it, and spreads around corners. The darkness lasts as long as the darkmantle maintains concentration, up to 10 minutes (as if concentrating on a spell). Darkvision can't penetrate this darkness, and no natural light can illuminate it. If any of the darkness overlaps with an area of light created by a spell of 2nd level or lower, the spell creating the light is dispelled.",
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.actionId(6527, 10),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.LONG_REST,
        amount: 1
      },
      effects: [
        {
          id: S.actionId(6527, 7),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: {
              code: S.ACTIVATION_CODE.BONUS_ACTION,
              amount: 1
            },
            range: { id: S.actionId(6527, 8), rangeKind: S.RANGE_KIND.SELF },
            shape: darknessAuraShape(11),
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.AREA_CONTENTS,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(6527, 9),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(6527, 9) + '__result',
                resultKind: 'SINGLE' as const,
                duration: {
                  id: S.actionId(6527, 12),
                  durationKind: DURATION_KIND.MINUTE,
                  amount: 10
                },
                maintenanceDefinitionId: SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
                outcomes: [
                  {
                    id: S.actionId(6527, 13),
                    effectKind: S.EFFECT_KIND.MANIFEST,
                    manifestKind: MANIFEST_KIND.ZONE,
                    attachmentKind: 'SOURCE' as const,
                    label: 'Darkness Aura',
                    shape: darknessAuraShape(14)
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
