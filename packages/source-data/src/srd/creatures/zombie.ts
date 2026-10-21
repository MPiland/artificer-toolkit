import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { damageInterceptionGrants } from './damageInterceptionGrants.js'
import * as S from './shared.js'
export const zombie: CreatureAuthored = {
  id: S.CREATURE_IDS.ZOMBIE,
  label: 'Zombie',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.UNDEAD,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000800000000',
  abilityScores: {
    STRENGTH: 13,
    DEXTERITY: 6,
    CONSTITUTION: 16,
    INTELLIGENCE: 3,
    WISDOM: 6,
    CHARISMA: 5
  },
  naturalArmorBonus: 0,
  hitPoints: 22,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 3,
    die: 8,
    modifier: 9
  },
  speeds: [...S.walk(20)],
  proficiencies: [S.grantedSaveProficiency(311, 1, 'WISDOM')],
  damageImmunities: ['poison'],
  conditionImmunities: ['poisoned'],
  senses: [S.darkvision(60)],
  passivePerception: 8,
  challengeRatingId: S.CR.CR_1_4,
  xp: 50,
  features: [
    {
      id: S.featureId(311, 1),
      label: 'Undead Fortitude',
      description:
        'Undead Fortitude. If damage reduces the zombie to 0 hit points, it must make a Constitution saving throw with a DC of 5 + the damage taken, unless the damage is radiant or from a critical hit. On a success, the zombie drops to 1 hit point instead.',
      grants: damageInterceptionGrants(S.actionId(311, 200), {
        dropToHitPoints: 1,
        negatesKill: false,
        save: { ability: 'CONSTITUTION', dc: { base: 5, plusDamageTaken: true } },
        excludes: { damageTypeIds: [S.damageTypeId('RADIANT')], critical: true }
      }),
      order: 1
    },
    {
      id: S.featureId(311, 2),
      label: 'Language Limitation',
      description: 'understands the languages it knew in life',
      order: 2
    },
    {
      id: S.featureId(311, 3),
      label: 'Slam',
      description:
        'Slam. Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 4 (1d6 + 1) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(311, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(311, 2),
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
              id: S.actionId(311, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(311, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(311, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6',
                    bonuses: [
                      {
                        id: S.actionId(311, 4),
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
      order: 3
    }
  ]
}
