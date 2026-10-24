import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
import * as R from './rollInfluenceGrants.js'
export const giantVulture: CreatureAuthored = {
  id: S.CREATURE_IDS.GIANT_VULTURE,
  label: 'Giant Vulture',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000800000000',
  abilityScores: {
    STRENGTH: 15,
    DEXTERITY: 10,
    CONSTITUTION: 15,
    INTELLIGENCE: 6,
    WISDOM: 12,
    CHARISMA: 7
  },
  naturalArmorBonus: 0,
  hitPoints: 22,
  details: [],
  senses: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 3,
    die: 10,
    modifier: 6
  },
  speeds: [...S.walk(10), ...S.fly(60)],
  proficiencies: [S.grantedSkillProficiency(137, 1, 'PERCEPTION')],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_1,
  xp: 200,
  features: [
    {
      id: S.featureId(137, 1),
      label: 'Keen Sight and Smell',
      description:
        'Keen Sight and Smell. The vulture has advantage on Wisdom (Perception) checks that rely on sight or smell.',
      order: 1
    },
    {
      id: S.featureId(137, 2),
      label: 'Pack Tactics',
      description:
        "Pack Tactics. The vulture has advantage on an attack roll against a creature if at least one of the vulture's allies is within 5 feet of the creature and the ally isn't incapacitated.",
      grants: R.conditionalAttackAdvantageGrants(137, 1, R.ENEMY_WITHIN_5_FEET_OF_TARGET),
      order: 2
    },
    {
      id: S.featureId(137, 3),
      label: 'Language Limitation',
      description: "understands Common but can't speak",
      grants: {
        proficiencies: [S.grantedLanguageProficiency(137, 2, 'COMMON')]
      },
      order: 3
    },
    {
      id: S.featureId(137, 4),
      label: 'Multiattack',
      description:
        'Multiattack. The vulture makes two attacks: one with its beak and one with its talons.',
      attackSlots: {
        alternatives: [
          {
            slots: [
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(137, 5) }] },
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(137, 6) }] }
            ]
          }
        ]
      },
      order: 4
    },
    {
      id: S.featureId(137, 5),
      label: 'Beak',
      description:
        'Beak. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (2d4 + 2) piercing damage.',
      effects: [
        {
          id: S.actionId(137, 7),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(137, 8),
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
              id: S.actionId(137, 9),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(137, 9) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(137, 9),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d4+2'
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
      id: S.featureId(137, 6),
      label: 'Talons',
      description:
        'Talons. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 9 (2d6 + 2) slashing damage.',
      effects: [
        {
          id: S.actionId(137, 10),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(137, 11),
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
              id: S.actionId(137, 12),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(137, 12) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(137, 12),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6+2'
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
