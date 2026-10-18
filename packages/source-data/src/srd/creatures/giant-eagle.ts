import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const giantEagle: CreatureAuthored = {
  id: S.CREATURE_IDS.GIANT_EAGLE,
  label: 'Giant Eagle',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.BEAST,
  creatureTypeId: S.CREATURE_TYPE.BEAST,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000200000000',
  abilityScores: {
    STRENGTH: 16,
    DEXTERITY: 17,
    CONSTITUTION: 13,
    INTELLIGENCE: 8,
    WISDOM: 14,
    CHARISMA: 10
  },
  naturalArmorBonus: 0,
  hitPoints: 26,
  details: [],
  senses: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 4,
    die: 10,
    modifier: 4
  },
  speeds: [...S.walk(10), ...S.fly(80)],
  proficiencies: [
    S.grantedSkillProficiency(121, 1, 'PERCEPTION'),
    S.grantedLanguageProficiency(121, 2, 'GIANT_EAGLE')
  ],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_1,
  xp: 200,
  features: [
    {
      id: S.featureId(121, 1),
      label: 'Keen Sight',
      description:
        'Keen Sight. The eagle has advantage on Wisdom (Perception) checks that rely on sight.',
      order: 1
    },
    {
      id: S.featureId(121, 2),
      label: 'Language Limitation',
      description: "understands Common and Auran but can't speak them",
      grants: {
        proficiencies: [S.grantedLanguageProficiency(121, 3, 'COMMON', 'AURAN')]
      },
      order: 2
    },
    {
      id: S.featureId(121, 3),
      label: 'Multiattack',
      description:
        'Multiattack. The eagle makes two attacks: one with its beak and one with its talons.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(121, 203),
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(121, 1203), rangeKind: S.RANGE_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_GIANT_EAGLE_MULTIATTACK
        })
      ],
      order: 3
    },
    {
      id: S.featureId(121, 4),
      label: 'Beak',
      description:
        'Beak. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) piercing damage.',
      effects: [
        {
          id: S.actionId(121, 204),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(121, 1204),
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
              id: S.actionId(121, 205),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(121, 206),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(121, 207),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6+3'
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 4
    },
    {
      id: S.featureId(121, 5),
      label: 'Talons',
      description:
        'Talons. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) slashing damage.',
      effects: [
        {
          id: S.actionId(121, 208),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(121, 1205),
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
              id: S.actionId(121, 209),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(121, 210),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(121, 211),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6+3'
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 5
    }
  ]
}
