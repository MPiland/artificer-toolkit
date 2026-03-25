import { type CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const barbedDevil: CreatureAuthored = {
  id: S.CREATURE_IDS.BARBED_DEVIL,
  label: 'Barbed Devil',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FIEND,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000700000000',
  tags: ['devil'],
  abilityScores: {
    STRENGTH: 16,
    DEXTERITY: 17,
    CONSTITUTION: 18,
    INTELLIGENCE: 12,
    WISDOM: 14,
    CHARISMA: 14,
    SPELLCASTING: 0
  },
  armorClass: 15,
  armorClassNote: 'natural armor',
  hitPoints: 110,
  hitDice: '13d8+52',
  speeds: [...S.walk(30), ...S.climb(30)],
  proficiencies: [
    S.grantedSaveProficiency(7311, 1, 'STRENGTH', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedSkillProficiency(7311, 2, 'DECEPTION', 'INSIGHT', 'PERCEPTION'),
    S.grantedLanguageProficiency(7311, 3, 'INFERNAL')
  ],
  damageResistances: ['cold; bludgeoning, piercing, and slashing from nonmagical attacks that aren\'t silvered'],
  damageImmunities: ['fire', 'poison'],
  conditionImmunities: ['poisoned'],
  senses: ['darkvision 120 ft.'],
  passivePerception: 18,
  challengeRatingId: S.CR.CR_5,
  xp: 1800,
  features: [
    {
      id: S.featureId(7311, 1),
      label: 'Barbed Hide',
      description: 'Barbed Hide. At the start of each of its turns, the devil deals 5 (1d10) piercing damage to any creature it is grappling or any creature grappling it.',
      order: 1
    },
    {
      id: S.featureId(7311, 2),
      label: "Devil's Sight",
      description: "Devil's Sight. Magical darkness doesn't impede the devil's darkvision.",
      order: 2
    },
    {
      id: S.featureId(7311, 3),
      label: 'Magic Resistance',
      description: 'Magic Resistance. The devil has advantage on saving throws against spells and other magical effects.',
      order: 3
    },
    {
      id: S.featureId(7311, 4),
      label: 'Multiattack',
      description: 'Multiattack. The devil makes two attacks: one with its tail and one with its claws.',
      order: 4
    },
    {
      id: S.featureId(7311, 5),
      label: 'Claw',
      description: 'Claw. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) piercing damage.',
      capabilities: [
        {
          id: S.actionId(7311, 1),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(7311, 2),
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
              id: S.actionId(7311, 3),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('PIERCING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d6',
              bonuses: [
                {
                  id: S.actionId(7311, 4),
                  bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                  ability: S.ABILITY_CODE.STRENGTH,
                  order: 1
                }
              ]
            }
          ]
        }
      ],
      order: 5
    },
    {
      id: S.featureId(7311, 6),
      label: 'Tail',
      description: 'Tail. Melee Weapon Attack: +6 to hit, reach 10 ft., one target. Hit: 10 (2d6 + 3) bludgeoning damage.',
      capabilities: [
        {
          id: S.actionId(7311, 5),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(7311, 6),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 10,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
            }
          },
          branches: [
            {
              id: S.actionId(7311, 7),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('BLUDGEONING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '2d6',
              bonuses: [
                {
                  id: S.actionId(7311, 8),
                  bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                  ability: S.ABILITY_CODE.STRENGTH,
                  order: 1
                }
              ]
            }
          ]
        }
      ],
      order: 6
    },
    {
      id: S.featureId(7311, 7),
      label: 'Hurl Flame',
      description: 'Hurl Flame. Ranged Spell Attack: +5 to hit, range 150 ft., one target. Hit: 10 (3d6) fire damage.',
      capabilities: [
        {
          id: S.actionId(7311, 9),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.RANGED_SPELL_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(7311, 10),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 150,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
            }
          },
          branches: [
            {
              id: S.actionId(7311, 11),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('FIRE'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '3d6'
            }
          ]
        }
      ],
      order: 7
    }
  ]
}
