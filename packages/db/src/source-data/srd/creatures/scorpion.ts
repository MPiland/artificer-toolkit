import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const scorpion: CreatureAuthored = {
  id: S.CREATURE_IDS.SCORPION,
  label: 'Scorpion',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.TINY,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 2,
    DEXTERITY: 11,
    CONSTITUTION: 8,
    INTELLIGENCE: 1,
    WISDOM: 8,
    CHARISMA: 2,
    SPELLCASTING: 0
  },
  armorClass: 11,
  armorClassNote: 'natural armor',
  hitPoints: 1,
  hitDice: '1d4 - 1',
  speeds: [...S.walk(10)],
  senses: ['blindsight 10 ft.'],
  passivePerception: 9,
  challengeRatingId: S.CR.CR_0,
  xp: 10,
  features: [
    {
      id: S.featureId(246, 1),
      label: 'Sting',
      description: 'Sting. Melee Weapon Attack: +2 to hit, reach 5 ft., one creature. Hit: 1 piercing damage, and the target must make a DC 9 Constitution saving throw, taking 4 (1d8) poison damage on a failed save, or half as much damage on a successful one.',
      capabilities: [
        {
          id: S.actionId(246, 1),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(246, 2),
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
              id: S.actionId(246, 3),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('PIERCING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1'
            },
            {
              id: S.actionId(246, 4),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('POISON'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '1d8',
              multiplier: 0.5,
            }
          ]
        }
      ],
      order: 1
    }
  ]
}
