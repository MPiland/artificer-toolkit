import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const poisonousSnake: CreatureAuthored = {
  id: S.CREATURE_IDS.POISONOUS_SNAKE,
  label: 'Poisonous Snake',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.TINY,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 2,
    DEXTERITY: 16,
    CONSTITUTION: 11,
    INTELLIGENCE: 1,
    WISDOM: 10,
    CHARISMA: 3,
    SPELLCASTING: 0
  },
  armorClass: 13,
  hitPoints: 2,
  hitDice: '1d4',
  speeds: [...S.walk(30), ...S.swim(30)],
  senses: ['blindsight 10 ft.'],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_1_8,
  xp: 25,
  features: [
    {
      id: S.featureId(222, 1),
      label: 'Bite',
      description: 'Bite. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 1 piercing damage, and the target must make a DC 10 Constitution saving throw, taking 5 (2d4) poison damage on a failed save, or half as much damage on a successful one.',
      capabilities: [
        {
          id: S.actionId(222, 1),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(222, 2),
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
              id: S.actionId(222, 3),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SEQUENTIAL,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('PIERCING'),
              valueKind: S.DAMAGE_VALUE_KIND.FIXED,
              scalingKind: S.SCALING.NONE,
              amount: 1
            },
            {
              id: S.actionId(222, 4),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SEQUENTIAL,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('POISON'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '2d4',
              multiplier: 0.5,
            }
          ]
        }
      ],
      order: 1
    }
  ]
}
