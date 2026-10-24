import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import { CHANGE_SHAPE_RULING } from './changeShapeRuling.js'
import { DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'
import { indefiniteInvisibilityEffect } from './indefiniteInvisibility.js'
export const quasit: CreatureAuthored = {
  id: S.CREATURE_IDS.QUASIT,
  label: 'Quasit',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FIEND,
  size: S.SIZE_CODE.TINY,
  alignmentId: '00000000-0000-0000-0001-000900000000',
  tags: ['demon', 'shapechanger'],
  abilityScores: {
    STRENGTH: 5,
    DEXTERITY: 17,
    CONSTITUTION: 10,
    INTELLIGENCE: 7,
    WISDOM: 10,
    CHARISMA: 10
  },
  naturalArmorBonus: 0,
  hitPoints: 7,
  details: [],
  damageVulnerabilities: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 3,
    die: 4,
    modifier: 0
  },
  speeds: [...S.walk(40)],
  proficiencies: [
    S.grantedSkillProficiency(2663, 1, 'STEALTH'),
    S.grantedLanguageProficiency(2663, 2, 'ABYSSAL', 'COMMON')
  ],
  damageResistances: [
    'cold',
    'fire',
    'lightning',
    'bludgeoning, piercing, and slashing from nonmagical attacks'
  ],
  damageImmunities: ['poison'],
  conditionImmunities: ['poisoned'],
  senses: [S.darkvision(120)],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_1,
  xp: 200,
  features: [
    {
      id: S.featureId(228, 1),
      label: 'Shapechanger',
      description:
        "Shapechanger. The quasit can use its action to polymorph into a beast form that resembles a bat (speed 10 ft. fly 40 ft.), a centipede (40 ft., climb 40 ft.), or a toad (40 ft., swim 40 ft.), or back into its true form. Its statistics are the same in each form, except for the speed changes noted. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.",
      effects: [
        S.manualAdjudicationEffect({
          id: S.actionId(228, 501),
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(228, 601), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ...CHANGE_SHAPE_RULING.BEAST_SPEED_FORM
        })
      ],
      order: 1
    },
    {
      id: S.featureId(228, 2),
      label: 'Magic Resistance',
      description:
        'Magic Resistance. The quasit has advantage on saving throws against spells and other magical effects.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(228, 502),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(228, 602), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_MAGIC_RESISTANCE
        })
      ],
      order: 2
    },
    {
      id: S.featureId(228, 3),
      label: 'Claws (Bite in Beast Form)',
      description:
        'Claws (Bite in Beast Form). Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d4 + 3) piercing damage, and the target must succeed on a DC 10 Constitution saving throw or take 5 (2d4) poison damage and become poisoned for 1 minute. The target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success.',
      effects: [
        {
          id: S.actionId(2663, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(2663, 2),
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
              id: S.actionId(2663, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(228, 933),
                resultKind: 'SEQUENCE' as const,
                duration: {
                  id: S.actionId(228, 934),
                  durationKind: DURATION_KIND.MINUTE,
                  amount: 1
                },
                outcomes: [
                  {
                    id: S.actionId(2663, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d4',
                    bonuses: [
                      {
                        id: S.actionId(2663, 4),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.DEXTERITY,
                        order: 1
                      }
                    ]
                  },
                  {
                    id: S.actionId(228, 930),
                    effectKind: S.EFFECT_KIND.FOLLOW_UP_SAVE,
                    timing: S.FOLLOW_UP_SAVE_TIMING.IMMEDIATE,
                    repeatTiming: S.FOLLOW_UP_SAVE_TIMING.TARGET_TURN_END,
                    savingThrow: {
                      id: S.actionId(228, 603),
                      dcMethod: 'FIXED_DC',
                      abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION,
                      baseDc: 10
                    },
                    attempts: { kind: 'ONCE', repeatOnFailure: true },
                    onSuccess: { kind: 'END' },
                    onFailure: {
                      kind: 'OUTCOMES',
                      endCurrent: false,
                      resultKind: 'SEQUENCE',
                      outcomes: [
                        {
                          id: S.actionId(228, 931),
                          effectKind: S.EFFECT_KIND.DAMAGE,
                          damageTypeId: S.damageTypeId('POISON'),
                          valueKind: S.DAMAGE_VALUE_KIND.DICE,
                          scalingKind: S.SCALING.NONE,
                          diceConfig: '2d4'
                        },
                        {
                          id: S.actionId(228, 932),
                          effectKind: S.EFFECT_KIND.CONDITION,
                          conditionId: conditionTypeId('POISONED')
                        }
                      ]
                    }
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 3
    },
    {
      id: S.featureId(228, 4),
      label: 'Scare (1/Day)',
      description:
        "Scare (1/Day). One creature of the quasit's choice within 20 feet of it must succeed on a DC 10 Wisdom saving throw or be frightened for 1 minute. The target can repeat the saving throw at the end of each of its turns, with disadvantage if the quasit is within line of sight, ending the effect on itself on a success.",
      effects: [
        {
          id: S.actionId(228, 504),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.SAVING_THROW,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            resourceUse: { chargeId: S.actionId(228, 954), cost: 1 },
            savingThrow: {
              id: S.actionId(228, 604),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM,
              baseDc: 10
            },
            range: {
              id: S.actionId(228, 605),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 20,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(228, 804),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(228, 955),
                resultKind: 'SEQUENCE' as const,
                duration: {
                  id: S.actionId(228, 947),
                  durationKind: 'ROUND',
                  amount: 10
                },
                outcomes: [
                  {
                    id: S.actionId(228, 940),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('FRIGHTENED'),
                    recordsSource: true
                  },
                  {
                    id: S.actionId(228, 948),
                    effectKind: S.EFFECT_KIND.FOLLOW_UP_SAVE,
                    timing: S.FOLLOW_UP_SAVE_TIMING.TARGET_TURN_END,
                    savingThrow: {
                      id: S.actionId(228, 624),
                      dcMethod: 'FIXED_DC',
                      abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM,
                      baseDc: 10
                    },
                    attempts: { kind: 'ONCE', repeatOnFailure: true },
                    repeatRollInfluence: {
                      influence: 'DISADVANTAGE',
                      when: {
                        kind: 'PERCEPTION',
                        observer: 'TARGET',
                        subject: 'SOURCE',
                        requirement: 'SEE'
                      }
                    },
                    onSuccess: { kind: 'END' },
                    onFailure: { kind: 'CONTINUE' },
                    onDurationComplete: { kind: 'END' }
                  }
                ]
              }
            }
          ]
        }
      ],
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.actionId(228, 954),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.DAILY,
        amount: 1
      },
      order: 4
    },
    {
      id: S.featureId(228, 5),
      label: 'Invisibility',
      description:
        'Invisibility. The quasit magically turns invisible until it attacks or uses Scare, or until its concentration ends (as if concentrating on a spell). Any equipment the quasit wears or carries is invisible with it.',
      effects: [
        indefiniteInvisibilityEffect({
          effectId: S.actionId(2663, 5),
          rangeId: S.actionId(2663, 6),
          pathId: S.actionId(2663, 7),
          endOnEvents: ['ON_ATTACK_ROLL']
        })
      ],
      order: 5
    }
  ]
}
