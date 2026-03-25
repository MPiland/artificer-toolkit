import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const rat: CreatureAuthored = {
  id: S.CREATURE_IDS.RAT,
  label: 'Rat',
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
    CONSTITUTION: 9,
    INTELLIGENCE: 2,
    WISDOM: 10,
    CHARISMA: 4,
    SPELLCASTING: 0
  },
  armorClass: 10,
  hitPoints: 1,
  hitDice: '1d4 - 1',
  speeds: [...S.walk(20)],
  senses: ['darkvision 30 ft.'],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_0,
  xp: 10,
  features: [
    {
      id: S.featureId(231, 1),
      label: 'Keen Smell',
      description: 'Keen Smell. The rat has advantage on Wisdom (Perception) checks that rely on smell.',
      order: 1
    },
    {
      id: S.featureId(231, 2),
      label: 'Bite',
      description: 'Bite. Melee Weapon Attack: +0 to hit, reach 5 ft., one target. Hit: 1 piercing damage.',
      capabilities: [
        {
          id: S.actionId(231, 1),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(231, 2),
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
              id: S.actionId(231, 3),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('PIERCING'),
              valueKind: S.DAMAGE_VALUE_KIND.FIXED,
              scalingKind: S.SCALING.NONE,
              amount: 1
            }
          ]
        }
      ],
      order: 2
    }
  ]
}
