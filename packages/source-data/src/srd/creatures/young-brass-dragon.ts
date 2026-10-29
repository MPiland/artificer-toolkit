import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import { DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'
export const youngBrassDragon: CreatureAuthored = {
  id: S.CREATURE_IDS.YOUNG_BRASS_DRAGON,
  label: 'Young Brass Dragon',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.DRAGON,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000300000000',
  abilityScores: {
    STRENGTH: 19,
    DEXTERITY: 10,
    CONSTITUTION: 17,
    INTELLIGENCE: 12,
    WISDOM: 11,
    CHARISMA: 15
  },
  naturalArmorBonus: 7,
  hitPoints: 110,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 13,
    die: 10,
    modifier: 39
  },
  speeds: [...S.walk(40), ...S.burrow(20), ...S.fly(80)],
  proficiencies: [
    S.grantedSkillExpertise(303, 4, 'PERCEPTION'),
    S.grantedSaveProficiency(303, 1, 'DEXTERITY', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedSkillProficiency(303, 2, 'PERSUASION', 'STEALTH'),
    S.grantedLanguageProficiency(303, 3, 'COMMON', 'DRACONIC')
  ],
  damageImmunities: ['fire'],
  senses: [S.blindsight(30), S.darkvision(120)],
  passivePerception: 16,
  challengeRatingId: S.CR.CR_6,
  xp: 2300,
  features: [
    {
      id: S.featureId(303, 1),
      label: 'Multiattack',
      description: 'The dragon makes three attacks: one with its bite and two with its claws.',
      attackSlots: {
        alternatives: [
          {
            slots: [
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(303, 2) }] },
              { count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(303, 3) }] }
            ]
          }
        ]
      },
      order: 1
    },
    {
      id: S.featureId(303, 2),
      label: 'Bite',
      description:
        'Melee Weapon Attack: +7 to hit, reach 10 ft., one target. Hit: 15 (2d10 + 4) piercing damage.',
      effects: [
        S.weaponAttack({
          creatureIndex: 303,
          localIndex: 31,
          kind: 'MELEE',
          feet: 10,
          damageType: 'PIERCING',
          diceConfig: '2d10',
          ability: 'STRENGTH'
        })
      ],
      order: 2
    },
    {
      id: S.featureId(303, 3),
      label: 'Claw',
      description:
        'Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 11 (2d6 + 4) slashing damage.',
      effects: [
        {
          id: S.actionId(303, 8),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(303, 9),
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
              id: S.actionId(303, 10),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(303, 10) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(303, 10),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6',
                    bonuses: [
                      {
                        id: S.actionId(303, 11),
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
      id: S.featureId(303, 4),
      ruleDefinitionIds: [S.DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID],
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: S.rechargeFeatureCharge(S.featureId(303, 4)),
      label: 'Breath Weapons (Recharge 5-6)',
      description:
        'The dragon uses one of the following breath weapons. Fire Breath. The dragon exhales fire in a 40-foot line that is 5 feet wide. Each creature in that line must make a DC 14 Dexterity saving throw, taking 42 (12d6) fire damage on a failed save, or half as much damage on a successful one. Sleep Breath. The dragon exhales sleep gas in a 30-foot cone. Each creature in that area must succeed on a DC 14 Constitution saving throw or fall unconscious for 5 minutes. This effect ends for a creature if the creature takes damage or someone uses an action to wake it.',
      effects: [
        {
          id: S.actionId(303, 12),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(303, 13),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.DEXTERITY,
              baseDc: 14
            },
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            ...S.selfLine(S.actionId(303, 14), S.actionId(303, 22), 40, 5)
          },
          paths: [
            {
              id: S.actionId(303, 15),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(303, 15) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(303, 15),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('FIRE'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '12d6'
                  }
                ]
              }
            },
            {
              id: S.actionId(303, 16),
              order: 2,
              pathCode: S.PATH_CODE.ON_SAVE_SUCCESS,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(303, 16) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(303, 16),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('FIRE'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '12d6',
                    multiplier: 0.5
                  }
                ]
              }
            }
          ]
        },
        {
          id: S.actionId(303, 17),
          order: 2,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(303, 18),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION,
              baseDc: 14
            },
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            ...S.selfCone(S.actionId(303, 19), S.actionId(303, 23), 30)
          },
          paths: [
            {
              id: S.actionId(303, 20),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(303, 20) + '__result',
                resultKind: 'SINGLE' as const,
                duration: {
                  id: S.actionId(303, 21),
                  durationKind: DURATION_KIND.MINUTE,
                  amount: 5
                },
                lifecycle: {
                  endTriggers: [{ event: 'DAMAGE_TAKEN' as const, by: 'ANYONE' as const }]
                },
                outcomes: [
                  {
                    id: S.actionId(303, 20),
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
    }
  ]
}
