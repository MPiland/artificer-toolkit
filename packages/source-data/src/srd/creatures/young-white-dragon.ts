import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const youngWhiteDragon: CreatureAuthored = {
  id: S.CREATURE_IDS.YOUNG_WHITE_DRAGON,
  label: 'Young White Dragon',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.DRAGON,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000900000000',
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 10,
    CONSTITUTION: 18,
    INTELLIGENCE: 6,
    WISDOM: 11,
    CHARISMA: 12
  },
  naturalArmorBonus: 7,
  hitPoints: 133,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 14,
    die: 10,
    modifier: 56
  },
  speeds: [...S.walk(40), ...S.burrow(20), ...S.fly(80), ...S.swim(40)],
  proficiencies: [
    S.grantedSkillExpertise(310, 4, 'PERCEPTION'),
    S.grantedSaveProficiency(310, 1, 'DEXTERITY', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedSkillProficiency(310, 2, 'STEALTH'),
    S.grantedLanguageProficiency(310, 3, 'COMMON', 'DRACONIC')
  ],
  damageImmunities: ['cold'],
  senses: [S.blindsight(30), S.darkvision(120)],
  passivePerception: 16,
  challengeRatingId: S.CR.CR_6,
  xp: 2300,
  features: [
    {
      id: S.featureId(310, 1),
      label: 'Ice Walk',
      description:
        "Ice Walk. The dragon can move across and climb icy surfaces without needing to make an ability check. Additionally, difficult terrain composed of ice or snow doesn't cost it extra moment.",
      effects: [
        S.manualAdjudicationEffect({
          id: S.actionId(310, 200),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(310, 201), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          label: 'Ice Walk',
          reasonCode: 'EXTERNAL_WORLD_STATE',
          instructions:
            "The dragon moves across and climbs icy surfaces without an ability check, and difficult terrain of ice or snow doesn't cost it extra movement."
        })
      ],
      order: 1
    },
    {
      id: S.featureId(310, 2),
      label: 'Multiattack',
      description: 'The dragon makes three attacks: one with its bite and two with its claws.',
      attackSlots: {
        alternatives: [
          {
            slots: [
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(310, 3) }] },
              { count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(310, 4) }] }
            ]
          }
        ]
      },
      order: 2
    },
    {
      id: S.featureId(310, 3),
      label: 'Bite',
      description:
        'Bite. Melee Weapon Attack: +7 to hit, reach 10 ft., one target. Hit: 15 (2d10 + 4) piercing damage plus 4 (1d8) cold damage.',
      effects: [
        {
          id: S.actionId(310, 4),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(310, 5),
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
              id: S.actionId(310, 6),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(310, 6) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(310, 6),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d10',
                    bonuses: [
                      {
                        id: S.actionId(310, 7),
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
              id: S.actionId(310, 8),
              order: 2,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(310, 8) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(310, 8),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('COLD'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d8'
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
      id: S.featureId(310, 4),
      label: 'Claw',
      description:
        'Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 11 (2d6 + 4) slashing damage.',
      effects: [
        {
          id: S.actionId(310, 9),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(310, 10),
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
              id: S.actionId(310, 11),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(310, 11) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(310, 11),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6',
                    bonuses: [
                      {
                        id: S.actionId(310, 12),
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
      id: S.featureId(310, 5),
      ruleDefinitionIds: [S.DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID],
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: S.rechargeFeatureCharge(S.featureId(310, 5)),
      label: 'Cold Breath (Recharge 5-6)',
      description:
        'The dragon exhales an icy blast in a 30-foot cone. Each creature in that area must make a DC 15 Constitution saving throw, taking 45 (10d8) cold damage on a failed save, or half as much damage on a successful one.',
      effects: [
        {
          id: S.actionId(310, 13),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(310, 14),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION,
              baseDc: 15
            },
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            ...S.selfCone(S.actionId(310, 15), S.actionId(310, 300), 30)
          },
          paths: [
            {
              id: S.actionId(310, 16),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(310, 16) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(310, 16),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('COLD'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '10d8'
                  }
                ]
              }
            },
            {
              id: S.actionId(310, 17),
              order: 2,
              pathCode: S.PATH_CODE.ON_SAVE_SUCCESS,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(310, 17) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(310, 17),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('COLD'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '10d8',
                    multiplier: 0.5
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
