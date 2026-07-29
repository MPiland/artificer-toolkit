import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const kobold: CreatureAuthored = {
  id: S.CREATURE_IDS.KOBOLD,
  label: 'Kobold',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.HUMANOID,
  size: S.SIZE_CODE.SMALL,
  alignmentId: '00000000-0000-0000-0001-000700000000',
  tags: ['kobold'],
  abilityScores: {
    STRENGTH: 7,
    DEXTERITY: 15,
    CONSTITUTION: 9,
    INTELLIGENCE: 8,
    WISDOM: 7,
    CHARISMA: 8
  },
  armorClass: 12,
  hitPoints: 5,
  hitDice: {
    count: 2,
    die: 6,
    modifier: -2
  },
  speeds: [...S.walk(30)],
  proficiencies: [S.grantedLanguageProficiency(179, 1, 'COMMON', 'DRACONIC')],
  senses: ['darkvision 60 ft.'],
  passivePerception: 8,
  challengeRatingId: S.CR.CR_1_8,
  xp: 25,
  features: [
    {
      id: S.featureId(179, 1),
      label: 'Sunlight Sensitivity',
      description:
        'Sunlight Sensitivity. While in sunlight, the kobold has disadvantage on attack rolls, as well as on Wisdom (Perception) checks that rely on sight.',
      order: 1
    },
    {
      id: S.featureId(179, 2),
      label: 'Pack Tactics',
      description:
        "Pack Tactics. The kobold has advantage on an attack roll against a creature if at least one of the kobold's allies is within 5 feet of the creature and the ally isn't incapacitated.",
      order: 2
    },
    {
      id: S.featureId(179, 3),
      label: 'Dagger',
      description:
        'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 4 (1d4 + 2) piercing damage.',
      effects: [
        {
          id: S.actionId(179, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(179, 2),
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
              id: S.actionId(179, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(179, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(179, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d4',
                    bonuses: [
                      {
                        id: S.actionId(179, 4),
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
    },
    {
      id: S.featureId(179, 4),
      label: 'Sling',
      description:
        'Ranged Weapon Attack: +4 to hit, range 30/120 ft., one target. Hit: 4 (1d4 + 2) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(179, 5),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(179, 6), rangeKind: S.RANGE_KIND.SPECIAL },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(179, 7),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(179, 7) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(179, 7),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d4',
                    bonuses: [
                      {
                        id: S.actionId(179, 8),
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
      order: 4
    }
  ]
}
