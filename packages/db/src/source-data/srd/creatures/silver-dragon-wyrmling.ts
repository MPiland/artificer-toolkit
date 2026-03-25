import { DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'

export const silverDragonWyrmling: CreatureAuthored = {
  id: S.CREATURE_IDS.SILVER_DRAGON_WYRMLING,
  label: 'Silver Dragon Wyrmling',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.DRAGON,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000100000000',
  abilityScores: {
    STRENGTH: 19,
    DEXTERITY: 10,
    CONSTITUTION: 17,
    INTELLIGENCE: 12,
    WISDOM: 11,
    CHARISMA: 15,
    SPELLCASTING: 0
  },
  armorClass: 17,
  armorClassNote: 'natural armor',
  hitPoints: 45,
  hitDice: '6d8+18',
  speeds: [...S.walk(30), ...S.fly(60)],
  proficiencies: [
    S.grantedSaveProficiency(254, 1, 'DEXTERITY', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedSkillProficiency(254, 2, 'PERCEPTION', 'STEALTH'),
    S.grantedLanguageProficiency(254, 3, 'DRACONIC')
  ],
  damageImmunities: ['cold'],
  senses: ['blindsight 10 ft.', 'darkvision 60 ft.'],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_2,
  xp: 450,
  features: [
    {
      id: S.featureId(254, 1),
      label: 'Bite',
      description: 'Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 9 (1d10 + 4) piercing damage.',
      capabilities: [
        {
          id: S.actionId(254, 1),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(254, 2),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 5,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
            }
          },
          branches: [
            {
              id: S.actionId(254, 3),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('PIERCING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d10',
              bonuses: [
                {
                  id: S.actionId(254, 4),
                  bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                  ability: S.ABILITY_CODE.STRENGTH,
                  order: 1
                }
              ]
            }
          ]
        }
      ],
      order: 1
    },
    {
      id: S.featureId(254, 2),
      label: 'Breath Weapons (Recharge 5-6)',
      description: 'The dragon uses one of the following breath weapons.',
      capabilities: [
        {
          id: S.actionId(254, 5),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(254, 6),
              savingThrowKind: 'SOURCE_SAVE_DC',
              ability: S.ABILITY_CODE.CONSTITUTION
            },
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(254, 7),
              rangeKind: S.RANGE_KIND.SPECIAL
            }
          },
          branches: [
            {
              id: S.actionId(254, 8),
              branch: S.BRANCH.ON_SAVE_FAIL,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('COLD'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '4d8'
            },
            {
              id: S.actionId(254, 9),
              branch: S.BRANCH.ON_SAVE_SUCCESS,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('COLD'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '4d8',
              multiplier: 0.5
            }
          ]
        },
        {
          id: S.actionId(254, 10),
          order: 2,
          invocation: {
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(254, 11),
              savingThrowKind: 'SOURCE_SAVE_DC',
              ability: S.ABILITY_CODE.CONSTITUTION
            },
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(254, 12),
              rangeKind: S.RANGE_KIND.SPECIAL
            }
          },
          branches: [
            {
              id: S.actionId(254, 13),
              branch: S.BRANCH.ON_SAVE_FAIL,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.CONDITION,
              duration: {
                id: S.actionId(254, 14),
                durationKind: DURATION_KIND.MINUTE,
                amount: 1
              },
              conditionId: conditionTypeId('PARALYZED'),
            }
          ]
        }
      ],
      order: 2
    }
  ]
}
