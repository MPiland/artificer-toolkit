import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CR, CREATURE_IDS, CREATURE_TYPE, SRD_SYSTEM_ID, SRD_USER_ID, walk } from './shared.js'
import * as S from './shared.js'

export const banditCaptain: CreatureAuthored = {
  id: CREATURE_IDS.BANDIT_CAPTAIN,
  label: 'Bandit Captain',
  description: 'Medium humanoid (any race), any non-lawful alignment',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'NPC',
  creatureTypeId: CREATURE_TYPE.HUMANOID,
  size: 'MEDIUM',
  tags: ['any race'],
  abilityScores: {
    STRENGTH: 15,
    DEXTERITY: 16,
    CONSTITUTION: 14,
    INTELLIGENCE: 14,
    WISDOM: 11,
    CHARISMA: 14
  },
  armorClass: 15,
  armorClassNote: 'studded leather',
  hitPoints: 65,
  hitDice: {
    count: 10,
    die: 8,
    modifier: 20
  },
  speeds: walk(30),
  proficiencies: [
    S.grantedSkillProficiency(38, 2, 'ATHLETICS', 'DECEPTION'),
    S.grantedSaveProficiency(38, 1, 'STRENGTH', 'DEXTERITY', 'WISDOM')
  ],
  passivePerception: 10,
  challengeRatingId: CR.CR_2,
  xp: 450,
  features: [
    {
      id: S.featureId(38, 1),
      label: 'Multiattack',
      description:
        'Multiattack. The captain makes three melee attacks: two with its scimitar and one with its dagger. Or the captain makes two ranged attacks with its daggers.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(38, 101),
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(38, 102), rangeKind: S.RANGE_KIND.SPECIAL }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_MULTIATTACK
        })
      ],
      order: 1
    },
    {
      id: S.featureId(38, 2),
      label: 'Scimitar',
      description:
        'Scimitar. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) slashing damage.',
      effects: [
        {
          id: S.actionId(38, 103),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(38, 104),
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
              id: S.actionId(38, 105),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${S.actionId(38, 105)}__result`,
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(38, 106),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6',
                    bonuses: [
                      {
                        id: S.actionId(38, 107),
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
      id: S.featureId(38, 3),
      label: 'Dagger',
      description:
        'Dagger. Melee or Ranged Weapon Attack: +5 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 5 (1d4 + 3) piercing damage.',
      effects: [
        ...[S.TRIGGER.MELEE_WEAPON_ATTACK, S.TRIGGER.RANGED_WEAPON_ATTACK].map(
          (triggerCode, index) => ({
            id: S.actionId(38, 108 + index * 4),
            order: index + 1,
            invocation: {
              kind: 'ACTION' as const,
              triggerCode,
              activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
              range:
                index === 0
                  ? {
                      id: S.actionId(38, 109),
                      rangeKind: S.RANGE_KIND.DISTANCE,
                      amount: 5,
                      unit: S.MEASUREMENT_UNIT_CODE.FEET
                    }
                  : { id: S.actionId(38, 113), rangeKind: S.RANGE_KIND.SPECIAL },
              targeting: {
                selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
                dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
              }
            },
            paths: [
              {
                id: S.actionId(38, 110 + index * 4),
                order: 1,
                pathCode: S.PATH_CODE.ON_HIT,
                groupType: S.PATH_GROUP_TYPE.SINGLE,
                originKind: 'SOURCE' as const,
                selectionKind: 'FIXED' as const,
                resultBlock: {
                  id: `${S.actionId(38, 110 + index * 4)}__result`,
                  resultKind: 'SINGLE' as const,
                  outcomes: [
                    {
                      id: S.actionId(38, 111 + index * 4),
                      effectKind: S.EFFECT_KIND.DAMAGE,
                      damageTypeId: S.damageTypeId('PIERCING'),
                      valueKind: S.DAMAGE_VALUE_KIND.DICE,
                      scalingKind: S.SCALING.NONE,
                      diceConfig: '1d4',
                      bonuses: [
                        {
                          id: S.actionId(38, 112 + index * 4),
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
          })
        )
      ],
      order: 3
    },
    {
      id: S.featureId(38, 4),
      label: 'Parry',
      description:
        'Parry. The captain adds 2 to its AC against one melee attack that would hit it. To do so, the captain must see the attacker and be wielding a melee weapon.',
      effects: [
        S.closedRuleEffect({
          id: S.reactionId(38, 101),
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.REACTION, amount: 1 },
            range: { id: S.reactionId(38, 102), rangeKind: S.RANGE_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_PARRY
        })
      ],
      order: 4
    }
  ]
}
