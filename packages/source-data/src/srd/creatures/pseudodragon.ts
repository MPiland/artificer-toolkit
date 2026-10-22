import { DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'
export const pseudodragon: CreatureAuthored = {
  id: S.CREATURE_IDS.PSEUDODRAGON,
  label: 'Pseudodragon',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.DRAGON,
  size: S.SIZE_CODE.TINY,
  alignmentId: '00000000-0000-0000-0001-000200000000',
  abilityScores: {
    STRENGTH: 6,
    DEXTERITY: 15,
    CONSTITUTION: 13,
    INTELLIGENCE: 10,
    WISDOM: 12,
    CHARISMA: 10
  },
  naturalArmorBonus: 1,
  hitPoints: 7,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 2,
    die: 4,
    modifier: 2
  },
  speeds: [...S.walk(15), ...S.fly(60)],
  proficiencies: [S.grantedSkillProficiency(226, 1, 'PERCEPTION', 'STEALTH')],
  senses: [S.blindsight(10), S.darkvision(60)],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_1_4,
  xp: 50,
  features: [
    {
      id: S.featureId(226, 1),
      label: 'Keen Senses',
      description:
        'Keen Senses. The pseudodragon has advantage on Wisdom (Perception) checks that rely on sight, hearing, or smell.',
      order: 1
    },
    {
      id: S.featureId(226, 2),
      label: 'Magic Resistance',
      description:
        'Magic Resistance. The pseudodragon has advantage on saving throws against spells and other magical effects.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(226, 501),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(226, 601), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_MAGIC_RESISTANCE
        })
      ],
      order: 2
    },
    {
      id: S.featureId(226, 3),
      label: 'Limited Telepathy',
      description:
        'Limited Telepathy. The pseudodragon can magically communicate simple ideas, emotions, and images telepathically with any creature within 100 feet of it that can understand a language.',
      order: 3
    },
    {
      id: S.featureId(226, 4),
      label: 'Language Limitation',
      description: "understands Common and Draconic but can't speak",
      grants: {
        proficiencies: [S.grantedLanguageProficiency(226, 2, 'DRACONIC', 'COMMON')]
      },
      order: 4
    },
    {
      id: S.featureId(226, 5),
      label: 'Bite',
      description:
        'Bite. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 4 (1d4 + 2) piercing damage.',
      effects: [
        {
          id: S.actionId(226, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(226, 2),
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
              id: S.actionId(226, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(226, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(226, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d4',
                    bonuses: [
                      {
                        id: S.actionId(226, 4),
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
      order: 5
    },
    {
      id: S.featureId(226, 6),
      label: 'Sting',
      description:
        'Sting. Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 4 (1d4 + 2) piercing damage, and the target must succeed on a DC 11 Constitution saving throw or become poisoned for 1 hour. If the saving throw fails by 5 or more, the target falls unconscious for the same duration, or until it takes damage or another creature uses an action to shake it awake.',
      effects: [
        {
          id: S.actionId(226, 5),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(226, 6),
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
              id: S.actionId(226, 7),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(226, 15),
                resultKind: 'SEQUENCE' as const,
                // Poisoned for 1 hour (D62.2); a failure by 5 or more also knocks it unconscious.
                duration: {
                  id: S.actionId(226, 9),
                  durationKind: DURATION_KIND.HOUR,
                  amount: 1
                },
                outcomes: [
                  {
                    id: S.actionId(226, 7),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d4',
                    bonuses: [
                      {
                        id: S.actionId(226, 8),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.DEXTERITY,
                        order: 1
                      }
                    ]
                  },
                  {
                    ...S.conditionSave({
                      id: S.actionId(226, 10),
                      savingThrowId: S.actionId(226, 11),
                      ability: 'CONSTITUTION',
                      dc: 11,
                      conditionOutcomeId: S.actionId(226, 12),
                      conditionId: conditionTypeId('POISONED'),
                      repeatsAtTurnEnd: false
                    }),
                    failureMarginRider: {
                      id: S.actionId(226, 13),
                      failedBy: 5,
                      endsWithOutcomeId: S.actionId(226, 12),
                      outcomes: [
                        {
                          id: S.actionId(226, 14),
                          effectKind: S.EFFECT_KIND.CONDITION,
                          conditionId: conditionTypeId('UNCONSCIOUS')
                        }
                      ],
                      lifecycle: { endOnTriggers: S.WAKE_END_TRIGGERS }
                    }
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
