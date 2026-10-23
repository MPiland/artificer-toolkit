import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
import * as R from './rollInfluenceGrants.js'

export const thug: CreatureAuthored = {
  id: S.CREATURE_IDS.THUG,
  label: 'Thug',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.NPC,
  creatureTypeId: S.CREATURE_TYPE.HUMANOID,
  size: S.SIZE_CODE.MEDIUM,
  tags: ['any race'],
  abilityScores: {
    STRENGTH: 15,
    DEXTERITY: 11,
    CONSTITUTION: 14,
    INTELLIGENCE: 10,
    WISDOM: 10,
    CHARISMA: 11
  },
  naturalArmorBonus: 0,
  hitPoints: 32,
  details: [],
  senses: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 5,
    die: 8,
    modifier: 10
  },
  speeds: [...S.walk(30)],
  proficiencies: [S.grantedSkillProficiency(269, 1, 'INTIMIDATION')],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_1_2,
  xp: 100,
  features: [
    {
      id: S.featureId(269, 1),
      label: 'Pack Tactics',
      description:
        "Pack Tactics. The thug has advantage on an attack roll against a creature if at least one of the thug's allies is within 5 feet of the creature and the ally isn't incapacitated.",
      grants: R.conditionalAttackAdvantageGrants(269, 1, R.ENEMY_WITHIN_5_FEET_OF_TARGET),
      order: 1
    },
    {
      id: S.featureId(269, 2),
      label: 'Language Knowledge',
      description: 'any one language (usually Common)',
      grants: {
        proficiencies: [S.grantedLanguageProficiency(269, 2, 'COMMON')]
      },
      order: 2
    },
    {
      id: S.featureId(269, 3),
      label: 'Multiattack',
      description: 'The thug makes two melee attacks.',
      attackSlots: {
        alternatives: [
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(269, 4) }] }] }
        ]
      },
      order: 3
    },
    {
      id: S.featureId(269, 4),
      label: 'Mace',
      description:
        'Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 5 (1d6 + 2) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(269, 204),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(269, 205),
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
              id: S.actionId(269, 206),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(269, 207),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(269, 208),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6+2'
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
      id: S.featureId(269, 5),
      label: 'Heavy Crossbow',
      description:
        'Ranged Weapon Attack: +2 to hit, range 100/400 ft., one target. Hit: 5 (1d10) piercing damage.',
      effects: [
        {
          id: S.actionId(269, 209),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(269, 210),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 100,
              longAmount: 400,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(269, 211),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(269, 212),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(269, 213),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d10'
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
