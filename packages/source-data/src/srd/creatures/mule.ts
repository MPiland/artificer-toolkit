import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const mule: CreatureAuthored = {
  id: S.CREATURE_IDS.MULE,
  label: 'Mule',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 14,
    DEXTERITY: 10,
    CONSTITUTION: 13,
    INTELLIGENCE: 2,
    WISDOM: 10,
    CHARISMA: 5
  },
  naturalArmorBonus: 0,
  hitPoints: 11,
  hitDice: {
    count: 2,
    die: 8,
    modifier: 2
  },
  speeds: [...S.walk(40)],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_1_8,
  xp: 25,
  features: [
    {
      id: S.featureId(200, 1),
      label: 'Beast of Burden',
      description:
        'Beast of Burden. The mule is considered to be a Large animal for the purpose of determining its carrying capacity.',
      order: 1
    },
    {
      id: S.featureId(200, 2),
      label: 'Sure-Footed',
      description:
        'Sure-Footed. The mule has advantage on Strength and Dexterity saving throws made against effects that would knock it prone.',
      order: 2
    },
    {
      id: S.featureId(200, 3),
      label: 'Hooves',
      description:
        'Hooves. Melee Weapon Attack: +2 to hit, reach 5 ft., one target. Hit: 4 (1d4 + 2) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(200, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(200, 2),
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
              id: S.actionId(200, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(200, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(200, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d4+2'
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 3
    }
  ]
}
