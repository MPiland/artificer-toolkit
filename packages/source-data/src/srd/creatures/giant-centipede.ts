import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import { conditionTypeId } from '../equipment/shared.js'
export const giantCentipede: CreatureAuthored = {
  id: S.CREATURE_IDS.GIANT_CENTIPEDE,
  label: 'Giant Centipede',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.SMALL,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 5,
    DEXTERITY: 14,
    CONSTITUTION: 12,
    INTELLIGENCE: 1,
    WISDOM: 7,
    CHARISMA: 3
  },
  naturalArmorBonus: 1,
  hitPoints: 4,
  details: [],
  proficiencies: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 1,
    die: 6,
    modifier: 1
  },
  speeds: [...S.walk(30), ...S.climb(30)],
  senses: [S.blindsight(30)],
  passivePerception: 8,
  challengeRatingId: S.CR.CR_1_4,
  xp: 50,
  features: [
    {
      id: S.featureId(117, 1),
      label: 'Bite',
      description:
        'Bite. Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 4 (1d4 + 2) piercing damage, and the target must succeed on a DC 11 Constitution saving throw or take 10 (3d6) poison damage. If the poison damage reduces the target to 0 hit points, the target is stable but poisoned for 1 hour, even after regaining hit points, and is paralyzed while poisoned in this way.',
      effects: [
        {
          id: S.actionId(117, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(117, 2),
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
              id: S.actionId(117, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(117, 3) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(117, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d4+2'
                  },
                  {
                    id: S.actionId(117, 4),
                    effectKind: S.EFFECT_KIND.FOLLOW_UP_SAVE,
                    timing: S.FOLLOW_UP_SAVE_TIMING.IMMEDIATE,
                    savingThrow: {
                      id: S.actionId(117, 5),
                      dcMethod: 'FIXED_DC' as const,
                      abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION,
                      baseDc: 11
                    },
                    attempts: { kind: 'ONCE' as const },
                    onSuccess: { kind: 'END' as const },
                    onFailure: {
                      kind: 'OUTCOMES' as const,
                      endCurrent: false,
                      resultKind: 'SEQUENCE' as const,
                      gate: {
                        kind: 'REDUCED_TO_ZERO_BY' as const,
                        damageOutcomeId: S.actionId(117, 6)
                      },
                      outcomes: [
                        {
                          id: S.actionId(117, 6),
                          effectKind: S.EFFECT_KIND.DAMAGE,
                          damageTypeId: S.damageTypeId('POISON'),
                          valueKind: S.DAMAGE_VALUE_KIND.DICE,
                          scalingKind: S.SCALING.NONE,
                          diceConfig: '3d6'
                        },
                        {
                          id: S.actionId(117, 7),
                          effectKind: S.EFFECT_KIND.STABILIZE,
                          requiresZeroHitPoints: true as const
                        },
                        {
                          id: S.actionId(117, 8),
                          effectKind: S.EFFECT_KIND.CONDITION,
                          conditionId: conditionTypeId('POISONED')
                        },
                        {
                          id: S.actionId(117, 9),
                          effectKind: S.EFFECT_KIND.CONDITION,
                          conditionId: conditionTypeId('PARALYZED')
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
