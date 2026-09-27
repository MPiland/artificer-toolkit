import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'

export const deathDog: CreatureAuthored = {
  id: S.CREATURE_IDS.DEATH_DOG,
  label: 'Death Dog',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000800000000',
  abilityScores: {
    STRENGTH: 15,
    DEXTERITY: 14,
    CONSTITUTION: 14,
    INTELLIGENCE: 3,
    WISDOM: 13,
    CHARISMA: 6
  },
  armorClass: 12,
  hitPoints: 39,
  hitDice: {
    count: 6,
    die: 8,
    modifier: 12
  },
  speeds: [...S.walk(40)],
  proficiencies: [
    S.grantedSkillExpertise(1389, 2, 'PERCEPTION'),
    S.grantedSkillProficiency(1389, 1, 'STEALTH')
  ],
  senses: ['darkvision 120 ft.'],
  passivePerception: 15,
  challengeRatingId: S.CR.CR_1,
  xp: 200,
  features: [
    {
      id: S.featureId(77, 1),
      label: 'Two-Headed',
      description:
        'Two-Headed. The dog has advantage on Wisdom (Perception) checks and on saving throws against being blinded, charmed, deafened, frightened, stunned, or knocked unconscious.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(77, 201),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.INCOMING_SAVING_THROW,
            range: { id: S.actionId(77, 1201), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_DEATH_DOG_TWO_HEADED
        })
      ],
      order: 1
    },
    {
      id: S.featureId(77, 2),
      label: 'Multiattack',
      description: 'Multiattack. The dog makes two bite attacks.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(77, 202),
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(77, 1202), rangeKind: S.RANGE_KIND.SPECIAL }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_DEATH_DOG_MULTIATTACK
        })
      ],
      order: 2
    },
    {
      id: S.featureId(77, 3),
      label: 'Bite',
      description:
        'Bite. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) piercing damage. If the target is a creature, it must succeed on a DC 12 Constitution saving throw against disease or become poisoned until the disease is cured. Every 24 hours that elapse, the creature must repeat the saving throw, reducing its hit point maximum by 5 (1d10) on a failure. This reduction lasts until the disease is cured. The creature dies if the disease reduces its hit point maximum to 0.',
      effects: [
        {
          id: S.actionId(77, 203),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(77, 205),
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
              id: S.actionId(77, 206),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(77, 207),
                resultKind: 'SEQUENCE',
                outcomes: [
                  {
                    id: S.actionId(77, 208),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6',
                    bonuses: [
                      {
                        id: S.actionId(77, 209),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.STRENGTH,
                        order: 1
                      }
                    ]
                  },
                  {
                    id: S.actionId(77, 220),
                    effectKind: S.EFFECT_KIND.FOLLOW_UP_SAVE,
                    timing: S.FOLLOW_UP_SAVE_TIMING.IMMEDIATE,
                    savingThrow: {
                      id: S.actionId(77, 221),
                      dcMethod: 'FIXED_DC',
                      abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION,
                      baseDc: 12
                    },
                    attempts: { kind: 'ONCE' },
                    onSuccess: { kind: 'END' },
                    onFailure: {
                      kind: 'OUTCOMES',
                      endCurrent: false,
                      resultKind: 'SEQUENCE',
                      outcomes: [
                        {
                          id: S.actionId(77, 222),
                          effectKind: S.EFFECT_KIND.CONDITION,
                          conditionId: conditionTypeId('POISONED')
                        },
                        {
                          id: S.actionId(77, 223),
                          effectKind: S.EFFECT_KIND.CLOSED_RULE,
                          ruleKind: S.CLOSED_RULE_KIND.CREATURE_DEATH_DOG_DISEASE
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
    }
  ]
}
