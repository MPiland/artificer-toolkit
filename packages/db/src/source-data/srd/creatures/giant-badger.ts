import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const giantBadger: CreatureAuthored = {
  id: S.CREATURE_IDS.GIANT_BADGER,
  label: 'Giant Badger',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 13,
    DEXTERITY: 10,
    CONSTITUTION: 15,
    INTELLIGENCE: 2,
    WISDOM: 12,
    CHARISMA: 5,
    SPELLCASTING: 0
  },
  armorClass: 10,
  hitPoints: 13,
  hitDice: '2d8+4',
  speeds: [...S.walk(30), ...S.burrow(10)],
  senses: ['darkvision 30 ft.'],
  passivePerception: 11,
  challengeRatingId: S.CR.CR_1_4,
  xp: 50,
  features: [
    {
      id: S.featureId(114, 1),
      label: 'Keen Smell',
      description: 'Keen Smell. The badger has advantage on Wisdom (Perception) checks that rely on smell.',
      order: 1
    },
    {
      id: S.featureId(114, 2),
      label: 'Multiattack',
      description: 'Multiattack. The badger makes two attacks: one with its bite and one with its claws.',
      order: 2
    },
    {
      id: S.featureId(114, 3),
      label: 'Bite',
      description: 'Bite. Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 4 (1d6 + 1) piercing damage.',
      capabilities: [
        {
          id: S.actionId(114, 4),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(114, 5),
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
              id: S.actionId(114, 6),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('PIERCING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d6+1'
            }
          ]
        }
      ],
      order: 3
    },
    {
      id: S.featureId(114, 4),
      label: 'Claws',
      description: 'Claws. Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 6 (2d4 + 1) slashing damage.',
      capabilities: [
        {
          id: S.actionId(114, 7),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(114, 8),
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
              id: S.actionId(114, 9),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('SLASHING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '2d4+1'
            }
          ]
        }
      ],
      order: 4
    }
  ]
}

