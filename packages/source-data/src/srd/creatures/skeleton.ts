import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const skeleton: CreatureAuthored = {
  id: S.CREATURE_IDS.SKELETON,
  label: 'Skeleton',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.UNDEAD,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000700000000',
  abilityScores: {
    STRENGTH: 10,
    DEXTERITY: 14,
    CONSTITUTION: 15,
    INTELLIGENCE: 6,
    WISDOM: 8,
    CHARISMA: 5
  },
  armorClass: 13,
  armorClassNote: 'armor scraps',
  hitPoints: 13,
  hitDice: {
    count: 2,
    die: 8,
    modifier: 4
  },
  speeds: [...S.walk(30)],
  damageVulnerabilities: ['bludgeoning'],
  damageImmunities: ['poison'],
  conditionImmunities: ['exhaustion', 'poisoned'],
  senses: ['darkvision 60 ft.'],
  passivePerception: 9,
  challengeRatingId: S.CR.CR_1_4,
  xp: 50,
  features: [
    {
      id: S.featureId(255, 1),
      label: 'Language Limitation',
      description: "understands all languages it knew in life but can't speak",
      order: 1
    },
    {
      id: S.featureId(255, 2),
      label: 'Shortsword',
      description:
        'Shortsword. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) piercing damage.',
      effects: [
        {
          id: S.actionId(255, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(255, 2),
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
              id: S.actionId(255, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(255, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(255, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6',
                    bonuses: [
                      {
                        id: S.actionId(255, 4),
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
    },
    {
      id: S.featureId(255, 3),
      label: 'Shortbow',
      description:
        'Shortbow. Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6 + 2) piercing damage.',
      effects: [
        {
          id: S.actionId(255, 5),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(255, 6),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 80,
              longAmount: 320,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(255, 7),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(255, 7) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(255, 7),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6',
                    bonuses: [
                      {
                        id: S.actionId(255, 8),
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
