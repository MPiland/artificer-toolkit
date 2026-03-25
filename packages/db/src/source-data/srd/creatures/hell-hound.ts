import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const hellHound: CreatureAuthored = {
  id: S.CREATURE_IDS.HELL_HOUND,
  label: 'Hell Hound',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FIEND,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000700000000',
  abilityScores: {
    STRENGTH: 17,
    DEXTERITY: 12,
    CONSTITUTION: 14,
    INTELLIGENCE: 6,
    WISDOM: 13,
    CHARISMA: 6,
    SPELLCASTING: 0
  },
  armorClass: 15,
  armorClassNote: 'natural armor',
  hitPoints: 45,
  hitDice: '7d8+14',
  speeds: [...S.walk(50)],
  proficiencies: [
    S.grantedSkillProficiency(161, 1, 'PERCEPTION')
  ],
  damageImmunities: ['fire'],
  senses: ['darkvision 60 ft.'],
  passivePerception: 15,
  challengeRatingId: S.CR.CR_3,
  xp: 700,
  features: [
    {
      id: S.featureId(161, 1),
      label: 'Keen Hearing and Smell',
      description: 'Keen Hearing and Smell. The hound has advantage on Wisdom (Perception) checks that rely on hearing or smell.',
      order: 1
    },
    {
      id: S.featureId(161, 2),
      label: 'Pack Tactics',
      description: "Pack Tactics. The hound has advantage on an attack roll against a creature if at least one of the hound's allies is within 5 feet of the creature and the ally isn't incapacitated.",
      order: 2
    },
    {
      id: S.featureId(161, 3),
      label: 'Language Limitation',
      description: 'Understands Infernal but can\'t speak it.',
      grants: {
        proficiencies: [
          S.grantedLanguageProficiency(161, 2, 'INFERNAL')
        ]
      },
      order: 3
    },
    {
      id: S.featureId(161, 4),
      label: 'Bite',
      description: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) piercing damage plus 7 (2d6) fire damage.',
      capabilities: [
        {
          id: S.actionId(161, 1),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(161, 2),
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
              id: S.actionId(161, 3),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SEQUENTIAL,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('PIERCING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d8',
              bonuses: [
                {
                  id: S.actionId(161, 4),
                  bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                  ability: S.ABILITY_CODE.STRENGTH,
                  order: 1
                }
              ]
            },
            {
              id: S.actionId(161, 5),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SEQUENTIAL,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('FIRE'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '2d6'
            }
          ]
        }
      ],
      order: 4
    },
    {
      id: S.featureId(161, 5),
      label: 'Fire Breath (Recharge 5-6)',
      description: 'The hound exhales fire in a 15-foot cone. Each creature in that area must make a DC 12 Dexterity saving throw, taking 21 (6d6) fire damage on a failed save, or half as much damage on a successful one.',
      capabilities: [
        {
          id: S.actionId(161, 6),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(161, 7),
              savingThrowKind: 'SOURCE_SAVE_DC',
              ability: S.ABILITY_CODE.DEXTERITY
            },
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(161, 8),
              rangeKind: S.RANGE_KIND.SPECIAL
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.CHOSEN_CREATURES
            }
          },
          branches: [
            {
              id: S.actionId(161, 9),
              branch: S.BRANCH.ON_SAVE_FAIL,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('FIRE'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '6d6'
            },
            {
              id: S.actionId(161, 10),
              branch: S.BRANCH.ON_SAVE_SUCCESS,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('FIRE'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '6d6',
              multiplier: 0.5
            }
          ]
        }
      ],
      order: 5
    }
  ]
}
