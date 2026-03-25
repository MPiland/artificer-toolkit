import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const youngGreenDragon: CreatureAuthored = {
  id: S.CREATURE_IDS.YOUNG_GREEN_DRAGON,
  label: 'Young Green Dragon',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
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
    CHARISMA: 15,
    SPELLCASTING: 0
  },
  armorClass: 18,
  armorClassNote: 'natural armor',
  hitPoints: 136,
  hitDice: '16d10+48',
  speeds: [...S.walk(40), ...S.fly(80), ...S.swim(40)],
  proficiencies: [
    S.grantedSaveProficiency(307, 1, 'DEXTERITY', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedSkillProficiency(307, 2, 'DECEPTION', 'PERCEPTION', 'STEALTH'),
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
      description: 'Melee Weapon Attack: +7 to hit, reach 10 ft., one target. Hit: 15 (2d10 + 4) piercing damage plus 7 (2d6) poison damage.',
      order: 3
    },
    {
      id: S.featureId(307, 4),
      label: 'Claw',
      description: 'Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 11 (2d6 + 4) slashing damage.',
      capabilities: [
        {
          id: S.actionId(307, 9),
          order: 1,
          invocation: {
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
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
            }
          },
          branches: [
            {
              id: S.actionId(307, 11),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
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
      ],
      order: 4
    },
    {
      id: S.featureId(307, 5),
      label: 'Poison Breath (Recharge 5-6)',
      description: 'The dragon exhales poisonous gas in a 30-foot cone. Each creature in that area must make a DC 14 Constitution saving throw, taking 42 (12d6) poison damage on a failed save, or half as much damage on a successful one.',
      capabilities: [
        {
          id: S.actionId(307, 13),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(307, 14),
              savingThrowKind: 'SOURCE_SAVE_DC',
              ability: S.ABILITY_CODE.CONSTITUTION
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
          branches: [
            {
              id: S.actionId(307, 16),
              branch: S.BRANCH.ON_SAVE_FAIL,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('POISON'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '12d6'
            },
            {
              id: S.actionId(307, 17),
              branch: S.BRANCH.ON_SAVE_SUCCESS,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('POISON'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '12d6',
              multiplier: 0.5
            }
          ]
        }
      ],
      order: 5
    }
  ]
}
