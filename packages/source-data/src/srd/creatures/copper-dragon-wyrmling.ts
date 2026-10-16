import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import { DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const copperDragonWyrmling: CreatureAuthored = {
  id: S.CREATURE_IDS.COPPER_DRAGON_WYRMLING,
  label: 'Copper Dragon Wyrmling',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.DRAGON,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000300000000',
  abilityScores: {
    STRENGTH: 15,
    DEXTERITY: 12,
    CONSTITUTION: 13,
    INTELLIGENCE: 14,
    WISDOM: 11,
    CHARISMA: 13
  },
  naturalArmorBonus: 5,
  hitPoints: 22,
  hitDice: {
    count: 4,
    die: 8,
    modifier: 4
  },
  speeds: [...S.walk(30), ...S.climb(30), ...S.fly(60)],
  proficiencies: [
    S.grantedSkillExpertise(7951, 4, 'PERCEPTION'),
    S.grantedSaveProficiency(7951, 1, 'DEXTERITY', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedSkillProficiency(7951, 2, 'STEALTH'),
    S.grantedLanguageProficiency(7951, 3, 'DRACONIC')
  ],
  damageImmunities: ['acid'],
  senses: [S.blindsight(10), S.darkvision(60)],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_1,
  xp: 200,
  features: [
    {
      id: S.featureId(70, 1),
      label: 'Bite',
      description:
        'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (1d10 + 2) piercing damage.',
      effects: [
        {
          id: S.actionId(7951, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(7951, 2),
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
              id: S.actionId(7951, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(7951, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(7951, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d10',
                    bonuses: [
                      {
                        id: S.actionId(7951, 4),
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
      order: 1
    },
    {
      id: S.featureId(70, 3),
      ruleDefinitionIds: [S.DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID],
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: S.rechargeFeatureCharge(S.featureId(70, 3)),
      label: 'Breath Weapons (Recharge 5-6)',
      description:
        "The dragon uses one of the following breath weapons. Acid Breath. The dragon exhales acid in an 20-foot line that is 5 feet wide. Each creature in that line must make a DC 11 Dexterity saving throw, taking 18 (4d8) acid damage on a failed save, or half as much damage on a successful one. Slowing Breath. The dragon exhales gas in a 15-foot cone. Each creature in that area must succeed on a DC 11 Constitution saving throw. On a failed save, the creature can't use reactions, its speed is halved, and it can't make more than one attack on its turn. In addition, the creature can use either an action or a bonus action on its turn, but not both. These effects last for 1 minute. The creature can repeat the saving throw at the end of each of its turns, ending the effect on itself with a successful save.",
      effects: [
        {
          id: S.actionId(7951, 5),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(7951, 6),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.DEXTERITY,
              baseDc: 11
            },
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            ...S.selfLine(S.actionId(7951, 7), S.actionId(7951, 17), 20, 5)
          },
          paths: [
            {
              id: S.actionId(7951, 8),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(7951, 8) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(7951, 8),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('ACID'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '4d8'
                  }
                ]
              }
            },
            {
              id: S.actionId(7951, 9),
              order: 2,
              pathCode: S.PATH_CODE.ON_SAVE_SUCCESS,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(7951, 9) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(7951, 9),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('ACID'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '4d8',
                    multiplier: 0.5
                  }
                ]
              }
            }
          ]
        },
        {
          id: S.actionId(7951, 10),
          order: 2,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(7951, 11),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION,
              baseDc: 11
            },
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            ...S.selfCone(S.actionId(7951, 12), S.actionId(7951, 18), 15)
          },
          paths: [
            {
              id: S.actionId(7951, 13),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(7951, 900),
                resultKind: 'SEQUENCE' as const,
                duration: {
                  id: S.actionId(7951, 14),
                  durationKind: DURATION_KIND.MINUTE,
                  amount: 1
                },
                outcomes: [
                  {
                    id: S.actionId(7951, 901),
                    effectKind: S.EFFECT_KIND.APPLY_GRANT,
                    grants: {
                      modifiers: [
                        {
                          id: S.actionId(7951, 902),
                          grantKind: 'MODIFIER_GRANT',
                          valueDomainCode: 'REACTION_COUNT',
                          domain: {},
                          modifierKind: 'SET_VALUE',
                          scope: 'GLOBAL',
                          selectionKind: 'GRANTED',
                          payload: { amount: 0 },
                          order: 1
                        }
                      ]
                    }
                  },
                  {
                    id: S.actionId(7951, 15),
                    effectKind: S.EFFECT_KIND.FOLLOW_UP_SAVE,
                    timing: 'TARGET_TURN_END',
                    savingThrow: {
                      id: S.actionId(7951, 16),
                      dcMethod: 'FIXED_DC',
                      abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION,
                      baseDc: 11
                    },
                    attempts: { kind: 'ONCE', repeatOnFailure: true },
                    onSuccess: { kind: 'END' },
                    onFailure: { kind: 'CONTINUE' }
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
