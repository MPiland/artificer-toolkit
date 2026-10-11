import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const youngGreenDragon: CreatureAuthored = {
  id: S.CREATURE_IDS.YOUNG_GREEN_DRAGON,
  label: 'Young Green Dragon',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.DRAGON,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000700000000',
  abilityScores: {
    STRENGTH: 19,
    DEXTERITY: 12,
    CONSTITUTION: 17,
    INTELLIGENCE: 16,
    WISDOM: 13,
    CHARISMA: 15
  },
  naturalArmorBonus: 7,
  hitPoints: 136,
  hitDice: {
    count: 16,
    die: 10,
    modifier: 48
  },
  speeds: [...S.walk(40), ...S.fly(80), ...S.swim(40)],
  proficiencies: [
    S.grantedSkillExpertise(307, 4, 'PERCEPTION'),
    S.grantedSaveProficiency(307, 1, 'DEXTERITY', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedSkillProficiency(307, 2, 'DECEPTION', 'STEALTH'),
    S.grantedLanguageProficiency(307, 3, 'COMMON', 'DRACONIC')
  ],
  damageImmunities: ['poison'],
  conditionImmunities: ['poisoned'],
  senses: ['blindsight 30 ft.', 'darkvision 120 ft.'],
  passivePerception: 17,
  challengeRatingId: S.CR.CR_8,
  xp: 3900,
  features: [
    {
      id: S.featureId(307, 1),
      label: 'Amphibious',
      description: 'Amphibious. The dragon can breathe air and water.',
      order: 1
    },
    {
      id: S.featureId(307, 2),
      label: 'Multiattack',
      description: 'The dragon makes three attacks: one with its bite and two with its claws.',
      order: 2
    },
    {
      id: S.featureId(307, 3),
      label: 'Bite',
      description:
        'Melee Weapon Attack: +7 to hit, reach 10 ft., one target. Hit: 15 (2d10 + 4) piercing damage plus 7 (2d6) poison damage.',
      effects: [
        S.weaponAttack({
          creatureIndex: 307,
          localIndex: 31,
          kind: 'MELEE',
          feet: 10,
          damageType: 'PIERCING',
          diceConfig: '2d10',
          ability: 'STRENGTH',
          extraDamage: [{ damageType: 'POISON', diceConfig: '2d6' }]
        })
      ],
      order: 3
    },
    {
      id: S.featureId(307, 4),
      label: 'Claw',
      description:
        'Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 11 (2d6 + 4) slashing damage.',
      effects: [
        {
          id: S.actionId(307, 9),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(307, 10),
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
              id: S.actionId(307, 11),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(307, 11) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(307, 11),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6',
                    bonuses: [
                      {
                        id: S.actionId(307, 12),
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
      id: S.featureId(307, 5),
      ruleDefinitionIds: [S.DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID],
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: S.rechargeFeatureCharge(S.featureId(307, 5)),
      label: 'Poison Breath (Recharge 5-6)',
      description:
        'The dragon exhales poisonous gas in a 30-foot cone. Each creature in that area must make a DC 14 Constitution saving throw, taking 42 (12d6) poison damage on a failed save, or half as much damage on a successful one.',
      effects: [
        {
          id: S.actionId(307, 13),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(307, 14),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION,
              baseDc: 14
            },
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(307, 15),
              rangeKind: S.RANGE_KIND.SPECIAL
            }
          },
          paths: [
            {
              id: S.actionId(307, 16),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(307, 16) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(307, 16),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('POISON'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '12d6'
                  }
                ]
              }
            },
            {
              id: S.actionId(307, 17),
              order: 2,
              pathCode: S.PATH_CODE.ON_SAVE_SUCCESS,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(307, 17) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(307, 17),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('POISON'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '12d6',
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
