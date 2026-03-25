import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const brownBear: CreatureAuthored = {
  id: S.CREATURE_IDS.BROWN_BEAR,
  label: 'Brown Bear',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 19,
    DEXTERITY: 10,
    CONSTITUTION: 16,
    INTELLIGENCE: 2,
    WISDOM: 13,
    CHARISMA: 7,
    SPELLCASTING: 0
  },
  armorClass: 11,
  armorClassNote: 'natural armor',
  hitPoints: 34,
  hitDice: '4d10+12',
  speeds: [...S.walk(40), ...S.climb(30)],
  proficiencies: [
    S.grantedSkillProficiency(55, 1, 'PERCEPTION')
  ],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_1,
  xp: 200,
  features: [
    {
      id: S.featureId(55, 1),
      label: 'Keen Smell',
      description: 'Keen Smell. The bear has advantage on Wisdom (Perception) checks that rely on smell.',
      order: 1
    },
    {
      id: S.featureId(55, 2),
      label: 'Multiattack',
      description: 'Multiattack. The bear makes two attacks: one with its bite and one with its claws.',
      order: 2
    },
    {
      id: S.featureId(55, 3),
      label: 'Bite',
      description: 'Bite. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 8 (1d8 + 4) piercing damage.',
      capabilities: [
        {
          id: S.actionId(55, 4),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(55, 5),
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
              id: S.actionId(55, 6),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('PIERCING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d8+4'
            }
          ]
        }
      ],
      order: 3
    },
    {
      id: S.featureId(55, 4),
      label: 'Claws',
      description: 'Claws. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 11 (2d6 + 4) slashing damage.',
      capabilities: [
        {
          id: S.actionId(55, 7),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(55, 8),
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
              id: S.actionId(55, 9),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('SLASHING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '2d6+4'
            }
          ]
        }
      ],
      order: 4
    }
  ]
}

