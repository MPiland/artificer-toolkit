import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const redDragonWyrmling: CreatureAuthored = {
  id: S.CREATURE_IDS.RED_DRAGON_WYRMLING,
  label: 'Red Dragon Wyrmling',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.DRAGON,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000900000000',
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
  hitPoints: 75,
  hitDice: '10d8+30',
  speeds: [...S.walk(30), ...S.climb(30), ...S.fly(60)],
  proficiencies: [
    S.grantedSaveProficiency(233, 1, 'DEXTERITY', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedSkillProficiency(233, 2, 'PERCEPTION', 'STEALTH'),
    S.grantedLanguageProficiency(233, 3, 'DRACONIC')
  ],
  damageImmunities: ['fire'],
  senses: ['blindsight 10 ft.', 'darkvision 60 ft.'],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_4,
  xp: 1100,
  features: [
    {
      id: S.featureId(233, 1),
      label: 'Bite',
      description: 'Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 9 (1d10 + 4) piercing damage plus 3 (1d6) fire damage.',
      capabilities: [
        {
          id: S.actionId(233, 1),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(233, 2),
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
              id: S.actionId(233, 3),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SEQUENTIAL,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('PIERCING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d10',
              bonuses: [
                {
                  id: S.actionId(233, 4),
                  bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                  ability: S.ABILITY_CODE.STRENGTH,
                  order: 1
                }
              ]
            },
            {
              id: S.actionId(233, 5),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SEQUENTIAL,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('FIRE'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d6'
            }
          ]
        }
      ],
      order: 1
    },
    {
      id: S.featureId(233, 2),
      label: 'Fire Breath (Recharge 5-6)',
      description: 'The dragon exhales fire in a 15-foot cone. Each creature in that area must make a DC 13 Dexterity saving throw, taking 24 (7d6) fire damage on a failed save, or half as much damage on a successful one.',
      capabilities: [
        {
          id: S.actionId(233, 6),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(233, 7),
              savingThrowKind: 'SOURCE_SAVE_DC',
              ability: S.ABILITY_CODE.DEXTERITY
            },
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(233, 8),
              rangeKind: S.RANGE_KIND.SPECIAL
            }
          },
          branches: [
            {
              id: S.actionId(233, 9),
              branch: S.BRANCH.ON_SAVE_FAIL,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('FIRE'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '7d6'
            },
            {
              id: S.actionId(233, 10),
              branch: S.BRANCH.ON_SAVE_SUCCESS,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('FIRE'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '7d6',
              multiplier: 0.5
            }
          ]
        }
      ],
      order: 2
    }
  ]
}
