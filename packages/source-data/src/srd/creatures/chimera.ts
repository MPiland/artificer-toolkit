import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const chimera: CreatureAuthored = {
  id: S.CREATURE_IDS.CHIMERA,
  label: 'Chimera',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000900000000',
  abilityScores: {
    STRENGTH: 19,
    DEXTERITY: 11,
    CONSTITUTION: 19,
    INTELLIGENCE: 3,
    WISDOM: 14,
    CHARISMA: 10
  },
  naturalArmorBonus: 4,
  hitPoints: 114,
  hitDice: {
    count: 12,
    die: 10,
    modifier: 48
  },
  speeds: [...S.walk(30), ...S.fly(60)],
  proficiencies: [S.grantedSkillExpertise(62, 3, 'PERCEPTION')],
  senses: ['darkvision 60 ft.'],
  passivePerception: 18,
  challengeRatingId: S.CR.CR_6,
  xp: 2300,
  features: [
    {
      id: S.featureId(62, 1),
      label: 'Language Limitation',
      description: "understands Draconic but can't speak",
      grants: {
        proficiencies: [S.grantedLanguageProficiency(62, 2, 'DRACONIC')]
      },
      order: 1
    },
    {
      id: S.featureId(62, 2),
      label: 'Multiattack',
      description:
        'The chimera makes three attacks: one with its bite, one with its horns, and one with its claws. When its fire breath is available, it can use the breath in place of its bite or horns.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(62, 101),
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(62, 102), rangeKind: S.RANGE_KIND.SPECIAL }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_MULTIATTACK
        })
      ],
      order: 2
    },
    {
      id: S.featureId(62, 3),
      label: 'Bite',
      description:
        'Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 11 (2d6 + 4) piercing damage.',
      effects: [
        {
          id: S.actionId(62, 4),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(62, 5),
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
              id: S.actionId(62, 6),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(62, 6) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(62, 6),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6',
                    bonuses: [
                      {
                        id: S.actionId(62, 7),
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
      id: S.featureId(62, 4),
      label: 'Horns',
      description:
        'Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 10 (1d12 + 4) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(62, 8),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(62, 9),
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
              id: S.actionId(62, 10),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(62, 10) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(62, 10),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d12',
                    bonuses: [
                      {
                        id: S.actionId(62, 11),
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
    },
    {
      id: S.featureId(62, 5),
      label: 'Claws',
      description:
        'Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 11 (2d6 + 4) slashing damage.',
      effects: [
        {
          id: S.actionId(62, 12),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(62, 13),
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
              id: S.actionId(62, 14),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(62, 14) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(62, 14),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6',
                    bonuses: [
                      {
                        id: S.actionId(62, 15),
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
      order: 5
    },
    {
      id: S.featureId(62, 6),
      ruleDefinitionIds: [S.DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID],
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: S.rechargeFeatureCharge(S.featureId(62, 6)),
      label: 'Fire Breath (Recharge 5-6)',
      description:
        'The dragon head exhales fire in a 15-foot cone. Each creature in that area must make a DC 15 Dexterity saving throw, taking 31 (7d8) fire damage on a failed save, or half as much damage on a successful one.',
      effects: [
        {
          id: S.actionId(62, 16),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(62, 17),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.DEXTERITY,
              baseDc: 15
            },
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(62, 18),
              rangeKind: S.RANGE_KIND.SPECIAL
            }
          },
          paths: [
            {
              id: S.actionId(62, 19),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(62, 19) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(62, 19),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('FIRE'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '7d8'
                  }
                ]
              }
            },
            {
              id: S.actionId(62, 20),
              order: 2,
              pathCode: S.PATH_CODE.ON_SAVE_SUCCESS,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(62, 20) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(62, 20),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('FIRE'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '7d8',
                    multiplier: 0.5
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 6
    }
  ]
}
