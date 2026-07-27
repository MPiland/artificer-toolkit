import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const eagle: CreatureAuthored = {
  id: S.CREATURE_IDS.EAGLE,
  label: 'Eagle',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.SMALL,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 6,
    DEXTERITY: 15,
    CONSTITUTION: 10,
    INTELLIGENCE: 2,
    WISDOM: 14,
    CHARISMA: 7
  },
  armorClass: 12,
  hitPoints: 3,
  hitDice: {
    count: 1,
    die: 6,
    modifier: 0
  },
  speeds: [...S.walk(10), ...S.fly(60)],
  proficiencies: [S.grantedSkillProficiency(93, 1, 'PERCEPTION')],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_0,
  xp: 10,
  features: [
    {
      id: S.featureId(93, 1),
      label: 'Keen Sight',
      description:
        'Keen Sight. The eagle has advantage on Wisdom (Perception) checks that rely on sight.',
      order: 1
    },
    {
      id: S.featureId(93, 2),
      label: 'Talons',
      description:
        'Talons. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 4 (1d4 + 2) slashing damage.',
      effects: [
        {
          id: S.actionId(93, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(93, 2),
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
              id: S.actionId(93, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(93, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(93, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d4',
                    bonuses: [
                      {
                        id: S.actionId(93, 4),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.DEXTERITY,
                        order: 1
                      }
                    ]
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 2
    }
  ]
}
