import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const giantApe: CreatureAuthored = {
  id: S.CREATURE_IDS.GIANT_APE,
  label: 'Giant Ape',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.HUGE,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 23,
    DEXTERITY: 14,
    CONSTITUTION: 18,
    INTELLIGENCE: 7,
    WISDOM: 12,
    CHARISMA: 7,
    SPELLCASTING: 0
  },
  armorClass: 12,
  hitPoints: 157,
  hitDice: '15d12+60',
  speeds: [...S.walk(40), ...S.climb(40)],
  proficiencies: [
    S.grantedSkillProficiency(113, 1, 'ATHLETICS', 'PERCEPTION')
  ],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_7,
  xp: 2900,
  features: [
    {
      id: S.featureId(113, 1),
      label: 'Multiattack',
      description: 'Multiattack. The ape makes two fist attacks.',
      order: 1
    },
    {
      id: S.featureId(113, 2),
      label: 'Fist',
      description: 'Fist. Melee Weapon Attack: +9 to hit, reach 10 ft., one target. Hit: 22 (3d10 + 6) bludgeoning damage.',
      capabilities: [
        {
          id: S.actionId(113, 4),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(113, 5),
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
              id: S.actionId(113, 6),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('BLUDGEONING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '3d10+6'
            }
          ]
        }
      ],
      order: 2
    },
    {
      id: S.featureId(113, 3),
      label: 'Rock',
      description: 'Rock. Ranged Weapon Attack: +9 to hit, range 50/100 ft., one target. Hit: 30 (7d6 + 6) bludgeoning damage.',
      capabilities: [
        {
          id: S.actionId(113, 7),
          order: 1,
          invocation: {
            triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(113, 8),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 100,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
            }
          },
          branches: [
            {
              id: S.actionId(113, 9),
              branch: S.BRANCH.ON_HIT,
              groupType: S.BRANCH_GROUP_TYPE.SINGLE,
              resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
              effectKind: S.EFFECT_KIND.DAMAGE,
              damageTypeId: S.damageTypeId('BLUDGEONING'),
              valueKind: S.DAMAGE_VALUE_KIND.DICE,
              scalingKind: S.SCALING.NONE,
              diceConfig: '7d6+6'
            }
          ]
        }
      ],
      order: 3
    }
  ]
}
