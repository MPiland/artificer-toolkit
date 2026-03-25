import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const grick: CreatureAuthored = {
  id: S.CREATURE_IDS.GRICK,
  label: 'Grick',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.MEDIUM,
  abilityScores: {
    STRENGTH: 14,
    DEXTERITY: 14,
    CONSTITUTION: 11,
    INTELLIGENCE: 3,
    WISDOM: 14,
    CHARISMA: 5,
    SPELLCASTING: 0
  },
  armorClass: 14,
  armorClassNote: 'natural armor',
  hitPoints: 27,
  hitDice: '6d8',
  speeds: [...S.walk(30), ...S.climb(30)],
  damageResistances: ['bludgeoning, piercing, and slashing from nonmagical attacks'],
  senses: ['darkvision 60 ft.'],
  passivePerception: 12,
  challengeRatingId: S.CR.CR_2,
  xp: 450,
  features: [
    {
      id: S.featureId(152, 1),
      label: 'Stone Camouflage',
      description: 'Stone Camouflage. The grick has advantage on Dexterity (Stealth) checks made to hide in rocky terrain.',
      order: 1
    },
    {
      id: S.featureId(152, 2),
      label: 'Multiattack',
      description: 'Multiattack. The grick makes one attack with its tentacles. If that attack hits, the grick can make one beak attack against the same target.',
      order: 2
    },
    {
      id: S.featureId(152, 3),
      label: 'Tentacles',
      description: 'Tentacles. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 9 (2d6 + 2) slashing damage.',
      capabilities: [
        {
          id: S.actionId(152, 4),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(152, 5),
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
              id: S.actionId(152, 6),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('SLASHING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '2d6+2'
            }
          ]
        }
      ],
      order: 3
    },
    {
      id: S.featureId(152, 4),
      label: 'Beak',
      description: 'Beak. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) piercing damage.',
      capabilities: [
        {
          id: S.actionId(152, 7),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(152, 8),
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
              id: S.actionId(152, 9),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('PIERCING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d6+2'
            }
          ]
        }
      ],
      order: 4
    }
  ],
}
