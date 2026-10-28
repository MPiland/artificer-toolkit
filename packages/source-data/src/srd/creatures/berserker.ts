import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const berserker: CreatureAuthored = {
  id: S.CREATURE_IDS.BERSERKER,
  label: 'Berserker',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.NPC,
  creatureTypeId: S.CREATURE_TYPE.HUMANOID,
  size: S.SIZE_CODE.MEDIUM,
  tags: ['any race'],
  abilityScores: {
    STRENGTH: 16,
    DEXTERITY: 12,
    CONSTITUTION: 17,
    INTELLIGENCE: 9,
    WISDOM: 11,
    CHARISMA: 9
  },
  naturalArmorBonus: 0,
  hitPoints: 67,
  details: [],
  proficiencies: [],
  senses: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 9,
    die: 8,
    modifier: 27
  },
  speeds: [...S.walk(30)],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_2,
  xp: 450,
  features: [
    {
      id: S.featureId(44, 1),
      label: 'Reckless',
      description:
        'Reckless. At the start of its turn, the berserker can gain advantage on all melee weapon attack rolls during that turn, but attack rolls against it have advantage until the start of its next turn.',
      // Same rule as the Barbarian's Reckless Attack: its two grants end on different turn boundaries, so it is a GM ruling (D187a).
      effects: [
        S.manualAdjudicationEffect({
          id: S.actionId(44, 101),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(44, 102), rangeKind: S.RANGE_KIND.SELF }
          },
          label: 'Reckless',
          reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
          instructions:
            'At the start of its turn, the berserker can attack recklessly. It then has advantage on melee weapon attack rolls this turn, and attack rolls against it have advantage until the start of its next turn. The GM applies both.'
        })
      ],
      order: 1
    },
    {
      id: S.featureId(44, 2),
      label: 'Language Knowledge',
      description: 'any one language (usually Common)',
      grants: {
        proficiencies: [S.grantedLanguageProficiency(44, 1, 'COMMON')]
      },
      order: 2
    },
    {
      id: S.featureId(44, 3),
      label: 'Greataxe',
      description:
        'Greataxe. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 9 (1d12 + 3) slashing damage.',
      effects: [
        {
          id: S.actionId(44, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(44, 2),
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
              id: S.actionId(44, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(44, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(44, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d12',
                    bonuses: [
                      {
                        id: S.actionId(44, 4),
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
