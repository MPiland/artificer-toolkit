import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const balor: CreatureAuthored = {
  id: S.CREATURE_IDS.BALOR,
  label: 'Balor',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FIEND,
  size: S.SIZE_CODE.HUGE,
  alignmentId: '00000000-0000-0000-0001-000900000000',
  tags: ['demon'],
  abilityScores: {
    STRENGTH: 26,
    DEXTERITY: 15,
    CONSTITUTION: 22,
    INTELLIGENCE: 20,
    WISDOM: 16,
    CHARISMA: 22
  },
  armorClass: 19,
  armorClassNote: 'natural armor',
  hitPoints: 262,
  hitDice: {
    count: 21,
    die: 12,
    modifier: 126
  },
  speeds: [...S.walk(40), ...S.fly(80)],
  proficiencies: [
    S.grantedSaveProficiency(2128, 1, 'STRENGTH', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedSkillProficiency(2128, 2, 'PERCEPTION'),
    S.grantedLanguageProficiency(2128, 3, 'ABYSSAL')
  ],
  damageResistances: [
    'cold',
    'lightning',
    'bludgeoning, piercing, and slashing from nonmagical attacks'
  ],
  damageImmunities: ['fire', 'poison'],
  conditionImmunities: ['poisoned'],
  senses: ['truesight 120 ft.'],
  passivePerception: 19,
  challengeRatingId: S.CR.CR_19,
  xp: 22000,
  features: [
    {
      id: S.featureId(36, 1),
      label: 'Magic Resistance',
      description:
        'Magic Resistance. The balor has advantage on saving throws against spells and other magical effects.',
      order: 1
    },
    {
      id: S.featureId(36, 2),
      label: 'Fire Aura',
      description:
        "Fire Aura. At the start of each of the balor's turns, each creature within 5 feet of it takes 10 fire damage, and flammable objects in the aura that aren't being worn or carried ignite. Any creature that hits the balor with a melee attack while within 5 feet of it takes 10 fire damage.",
      order: 2
    },
    {
      id: S.featureId(36, 3),
      label: 'Death Throes',
      description:
        'Death Throes. When the balor dies, it explodes, and each creature within 30 feet of it must make a DC 20 Dexterity saving throw, taking 20d6 fire damage and 20d6 lightning damage on a failed save, or half as much damage on a successful one.',
      order: 3
    },
    {
      id: S.featureId(36, 4),
      label: 'Telepathy',
      description: 'Telepathy 120 ft.',
      order: 4
    },
    {
      id: S.featureId(36, 5),
      label: 'Multiattack',
      description: 'The balor makes two attacks: one with its longsword and one with its whip.',
      order: 5
    },
    {
      id: S.featureId(36, 6),
      label: 'Longsword',
      description:
        'Longsword. Melee Weapon Attack: +14 to hit, reach 10 ft., one target. Hit: 21 (3d6 + 11) slashing damage plus 13 (3d8) lightning damage. If the balor scores a critical hit, it rolls the damage dice three times instead of twice.',
      effects: [
        {
          id: S.actionId(2128, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(2128, 2),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 10,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(2128, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(2128, 3) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(2128, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '3d6',
                    bonuses: [
                      {
                        id: S.actionId(2128, 4),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.STRENGTH,
                        order: 1
                      }
                    ]
                  }
                ]
              }
            },
            {
              id: S.actionId(2128, 5),
              order: 2,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(2128, 5) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(2128, 5),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('LIGHTNING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '3d8'
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 6
    },
    {
      id: S.featureId(36, 7),
      label: 'Whip',
      description:
        'Whip. Melee Weapon Attack: +14 to hit, reach 30 ft., one target. Hit: 15 (2d6 + 8) slashing damage. If the target is a Large or smaller creature, it must succeed on a DC 20 Strength saving throw or be pulled up to 25 feet toward the balor.',
      effects: [
        {
          id: S.actionId(2128, 6),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(2128, 7),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 30,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(2128, 8),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(2128, 8) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(2128, 8),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6',
                    bonuses: [
                      {
                        id: S.actionId(2128, 9),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.STRENGTH,
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
      order: 7
    },
    {
      id: S.featureId(36, 8),
      label: 'Teleport',
      description:
        'Teleport. The balor magically teleports, along with any equipment it is wearing or carrying, up to 120 feet to an unoccupied space it can see.',
      effects: [
        {
          id: S.actionId(2128, 10),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(2128, 11),
              rangeKind: S.RANGE_KIND.SPECIAL
            }
          },
          paths: [
            {
              id: S.actionId(2128, 12),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(2128, 12) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(2128, 12),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 8
    }
  ]
}
