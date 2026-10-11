import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const bloodHawk: CreatureAuthored = {
  id: S.CREATURE_IDS.BLOOD_HAWK,
  label: 'Blood Hawk',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.SMALL,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 6,
    DEXTERITY: 14,
    CONSTITUTION: 10,
    INTELLIGENCE: 3,
    WISDOM: 14,
    CHARISMA: 5
  },
  naturalArmorBonus: 0,
  hitPoints: 7,
  hitDice: {
    count: 2,
    die: 6,
    modifier: 0
  },
  speeds: [...S.walk(10), ...S.fly(60)],
  proficiencies: [S.grantedSkillProficiency(49, 1, 'PERCEPTION')],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_1_8,
  xp: 25,
  features: [
    {
      id: S.featureId(49, 1),
      label: 'Keen Sight',
      description:
        'Keen Sight. The hawk has advantage on Wisdom (Perception) checks that rely on sight.',
      order: 1
    },
    {
      id: S.featureId(49, 2),
      label: 'Pack Tactics',
      description:
        "Pack Tactics. The hawk has advantage on an attack roll against a creature if at least one of the hawk's allies is within 5 feet of the creature and the ally isn't incapacitated.",
      order: 2
    },
    {
      id: S.featureId(49, 3),
      label: 'Beak',
      description:
        'Beak. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 4 (1d4 + 2) piercing damage.',
      effects: [
        {
          id: S.actionId(49, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(49, 2),
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
              id: S.actionId(49, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(49, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(49, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d4',
                    bonuses: [
                      {
                        id: S.actionId(49, 4),
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
      order: 3
    }
  ]
}
