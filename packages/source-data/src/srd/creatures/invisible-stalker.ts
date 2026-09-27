import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const invisibleStalker: CreatureAuthored = {
  id: S.CREATURE_IDS.INVISIBLE_STALKER,
  label: 'Invisible Stalker',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.ELEMENTAL,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000500000000',
  tags: ['hover'],
  abilityScores: {
    STRENGTH: 16,
    DEXTERITY: 19,
    CONSTITUTION: 14,
    INTELLIGENCE: 10,
    WISDOM: 15,
    CHARISMA: 11
  },
  armorClass: 14,
  hitPoints: 104,
  hitDice: {
    count: 16,
    die: 8,
    modifier: 32
  },
  speeds: [...S.walk(50), ...S.fly(50)],
  proficiencies: [
    S.grantedSkillExpertise(174, 4, 'PERCEPTION', 'STEALTH'),
    S.grantedLanguageProficiency(174, 2, 'AURAN')
  ],
  damageResistances: ['bludgeoning, piercing, and slashing from nonmagical attacks'],
  damageImmunities: ['poison'],
  conditionImmunities: [
    'exhaustion',
    'grappled',
    'paralyzed',
    'petrified',
    'poisoned',
    'prone',
    'restrained',
    'unconscious'
  ],
  senses: ['darkvision 60 ft.'],
  passivePerception: 18,
  challengeRatingId: S.CR.CR_6,
  xp: 2300,
  features: [
    {
      id: S.featureId(174, 1),
      label: 'Invisibility',
      description: 'Invisibility. The stalker is invisible.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(174, 201),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(174, 1201), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_INVISIBLE_STALKER_INVISIBILITY
        })
      ],
      order: 1
    },
    {
      id: S.featureId(174, 2),
      label: 'Faultless Tracker',
      description:
        'Faultless Tracker. The stalker is given a quarry by its summoner. The stalker knows the direction and distance to its quarry as long as the two of them are on the same plane of existence. The stalker also knows the location of its summoner.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(174, 202),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(174, 1202), rangeKind: S.RANGE_KIND.UNLIMITED },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_INVISIBLE_STALKER_FAULTLESS_TRACKER
        })
      ],
      order: 2
    },
    {
      id: S.featureId(174, 3),
      label: 'Language Limitation',
      description: "understands Common but doesn't speak it",
      grants: {
        proficiencies: [S.grantedLanguageProficiency(174, 3, 'COMMON')]
      },
      order: 3
    },
    {
      id: S.featureId(174, 4),
      label: 'Multiattack',
      description: 'Multiattack. The stalker makes two slam attacks.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(174, 204),
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(174, 1204), rangeKind: S.RANGE_KIND.SPECIAL }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_INVISIBLE_STALKER_MULTIATTACK
        })
      ],
      order: 4
    },
    {
      id: S.featureId(174, 5),
      label: 'Slam',
      description:
        'Slam. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(174, 4),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(174, 5),
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
              id: S.actionId(174, 6),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(174, 6) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(174, 6),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6',
                    bonuses: [
                      {
                        id: S.actionId(174, 7),
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
    }
  ]
}
