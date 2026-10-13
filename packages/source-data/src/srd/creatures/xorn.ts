import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const xorn: CreatureAuthored = {
  id: S.CREATURE_IDS.XORN,
  label: 'Xorn',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.ELEMENTAL,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000500000000',
  abilityScores: {
    STRENGTH: 17,
    DEXTERITY: 10,
    CONSTITUTION: 22,
    INTELLIGENCE: 11,
    WISDOM: 10,
    CHARISMA: 11
  },
  naturalArmorBonus: 9,
  hitPoints: 73,
  hitDice: {
    count: 7,
    die: 8,
    modifier: 42
  },
  speeds: [...S.walk(20), ...S.burrow(20)],
  proficiencies: [
    S.grantedSkillExpertise(300, 3, 'PERCEPTION'),
    S.grantedSkillProficiency(300, 1, 'STEALTH'),
    S.grantedLanguageProficiency(300, 2, 'TERRAN')
  ],
  damageResistances: ["piercing and slashing from nonmagical attacks that aren't adamantine"],
  senses: [S.darkvision(60), S.tremorsense(60)],
  passivePerception: 16,
  challengeRatingId: S.CR.CR_5,
  xp: 1800,
  features: [
    {
      id: S.featureId(300, 1),
      label: 'Earth Glide',
      description:
        "Earth Glide. The xorn can burrow through nonmagical, unworked earth and stone. While doing so, the xorn doesn't disturb the material it moves through.",
      order: 1
    },
    {
      id: S.featureId(300, 2),
      label: 'Stone Camouflage',
      description:
        'Stone Camouflage. The xorn has advantage on Dexterity (Stealth) checks made to hide in rocky terrain.',
      order: 2
    },
    {
      id: S.featureId(300, 3),
      label: 'Treasure Sense',
      description:
        'Treasure Sense. The xorn can pinpoint, by scent, the location of precious metals and stones, such as coins and gems, within 60 feet of it.',
      order: 3
    },
    {
      id: S.featureId(300, 4),
      label: 'Multiattack',
      description: 'Multiattack. The xorn makes three claw attacks and one bite attack.',
      order: 4
    },
    {
      id: S.featureId(300, 5),
      label: 'Claw',
      description:
        'Claw. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) slashing damage.',
      effects: [
        {
          id: S.actionId(300, 6),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(300, 7),
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
              id: S.actionId(300, 8),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(300, 8) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(300, 8),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6',
                    bonuses: [
                      {
                        id: S.actionId(300, 9),
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
      order: 5
    },
    {
      id: S.featureId(300, 6),
      label: 'Bite',
      description:
        'Bite. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 13 (3d6 + 3) piercing damage.',
      effects: [
        {
          id: S.actionId(300, 10),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(300, 11),
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
              id: S.actionId(300, 12),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(300, 12) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(300, 12),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '3d6',
                    bonuses: [
                      {
                        id: S.actionId(300, 13),
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
      order: 6
    }
  ]
}
