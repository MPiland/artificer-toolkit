import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const ridingHorse: CreatureAuthored = {
  id: S.CREATURE_IDS.RIDING_HORSE,
  label: 'Riding Horse',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 16,
    DEXTERITY: 10,
    CONSTITUTION: 12,
    INTELLIGENCE: 2,
    WISDOM: 11,
    CHARISMA: 7
  },
  naturalArmorBonus: 0,
  hitPoints: 13,
  hitDice: {
    count: 2,
    die: 10,
    modifier: 2
  },
  speeds: [...S.walk(60)],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_1_4,
  xp: 50,
  features: [
    {
      id: S.featureId(237, 1),
      label: 'Hooves',
      description:
        'Hooves. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 8 (2d4 + 3) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(237, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(237, 2),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 5,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(237, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(237, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(237, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d4+3'
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 1
    }
  ]
}
