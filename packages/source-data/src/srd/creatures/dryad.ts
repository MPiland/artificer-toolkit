import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import { DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared'
import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'
export const dryad: CreatureAuthored = {
  id: S.CREATURE_IDS.DRYAD,
  label: 'Dryad',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FEY,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000500000000',
  abilityScores: {
    STRENGTH: 10,
    DEXTERITY: 12,
    CONSTITUTION: 11,
    INTELLIGENCE: 14,
    WISDOM: 15,
    CHARISMA: 18
  },
  naturalArmorBonus: 0,
  hitPoints: 22,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 5,
    die: 8,
    modifier: 0
  },
  speeds: [...S.walk(30)],
  proficiencies: [
    S.grantedSkillExpertise(90, 3, 'STEALTH'),
    S.grantedSkillProficiency(90, 1, 'PERCEPTION'),
    S.grantedLanguageProficiency(90, 2, 'ELVISH', 'SYLVAN')
  ],
  senses: [S.darkvision(60)],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_1,
  xp: 200,
  features: [
    {
      id: S.featureId(90, 1),
      label: 'Innate Spellcasting',
      description:
        "Innate Spellcasting. The dryad's innate spellcasting ability is Charisma (spell save DC 14). The dryad can innately cast the following spells, requiring no material components: At will: druidcraft 3/day each: entangle, goodberry 1/day each: barkskin, pass without trace, shillelagh",
      grants: {
        spells: [
          {
            id: S.actionId(90, 301),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [S.SPELL_IDS.DRUIDCRAFT],
            attributes: [S.SPELL_GRANT_ATTRIBUTE.KNOWN, S.SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            order: 0
          },
          ...([S.SPELL_IDS.ENTANGLE, S.SPELL_IDS.GOODBERRY] as const).map((spellId, index) => ({
            id: S.actionId(90, 302 + index),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [spellId],
            attributes: [S.SPELL_GRANT_ATTRIBUTE.KNOWN, S.SPELL_GRANT_ATTRIBUTE.LIMITED_USE],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            charges: {
              id: S.actionId(90, 402 + index),
              limitKind: 'FIXED_AMOUNT' as const,
              scalingKind: S.SCALING.NONE,
              resetKind: S.CHARGE_RESET_KIND.DAILY,
              amount: 3
            },
            order: index + 1
          })),
          ...(
            [S.SPELL_IDS.BARKSKIN, S.SPELL_IDS.PASS_WITHOUT_TRACE, S.SPELL_IDS.SHILLELAGH] as const
          ).map((spellId, index) => ({
            id: S.actionId(90, 304 + index),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [spellId],
            attributes: [S.SPELL_GRANT_ATTRIBUTE.KNOWN, S.SPELL_GRANT_ATTRIBUTE.LIMITED_USE],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            charges: {
              id: S.actionId(90, 404 + index),
              limitKind: 'FIXED_AMOUNT' as const,
              scalingKind: S.SCALING.NONE,
              resetKind: S.CHARGE_RESET_KIND.DAILY,
              amount: 1
            },
            order: index + 3
          }))
        ]
      },
      order: 1
    },
    {
      id: S.featureId(90, 2),
      label: 'Magic Resistance',
      description:
        'Magic Resistance. The dryad has advantage on saving throws against spells and other magical effects.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(90, 202),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.INCOMING_SAVING_THROW,
            range: { id: S.actionId(90, 1202), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_MAGIC_RESISTANCE
        })
      ],
      order: 2
    },
    {
      id: S.featureId(90, 3),
      label: 'Speak with Beasts and Plants',
      description:
        'Speak with Beasts and Plants. The dryad can communicate with beasts and plants as if they shared a language.',
      order: 3
    },
    {
      id: S.featureId(90, 4),
      label: 'Tree Stride',
      description:
        'Tree Stride. Once on her turn, the dryad can use 10 feet of her movement to step magically into one living tree within her reach and emerge from a second living tree within 60 feet of the first tree, appearing in an unoccupied space within 5 feet of the second tree. Both trees must be Large or bigger.',
      effects: [
        {
          id: S.actionId(90, 204),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.FREE },
            range: {
              id: S.actionId(90, 1204),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 60,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          paths: [
            {
              id: S.actionId(90, 220),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(90, 221),
                resultKind: 'SEQUENCE',
                outcomes: [
                  {
                    id: S.actionId(90, 222),
                    effectKind: S.EFFECT_KIND.TELEPORT,
                    targetKind: 'SELF',
                    destinationKind: 'SPECIAL'
                  },
                  {
                    id: S.actionId(90, 223),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION,
                    label: 'Step between trees',
                    reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
                    instructions:
                      'Once on her turn, the dryad spends 10 feet of movement to enter a living tree within her reach and emerge in an unoccupied space within 5 feet of a second living tree within 60 feet of the first. Both trees must be Large or bigger; the GM confirms the trees and places her.'
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
      id: S.featureId(90, 5),
      label: 'Club',
      description:
        'Melee Weapon Attack: +2 to hit (+6 to hit with shillelagh), reach 5 ft., one target. Hit: 2 (1d4) bludgeoning damage, or 8 (1d8 + 4) bludgeoning damage with shillelagh.',
      options: [
        {
          id: S.actionId(90, 401),
          label: 'Club',
          description: '',
          order: 1,
          rollDefinitions: [
            {
              id: S.actionId(90, 450),
              label: 'Club attack',
              kind: 'ATTACK',
              expression: { count: 1, die: 20, modifier: 2 },
              rollMode: 'NORMAL',
              chargeCost: null,
              order: 1
            }
          ],
          effects: [
            {
              id: S.actionId(90, 1),
              order: 1,
              invocation: {
                kind: 'ACTION' as const,
                triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                range: {
                  id: S.actionId(90, 2),
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
                  id: S.actionId(90, 3),
                  order: 1,
                  pathCode: S.PATH_CODE.ON_HIT,
                  groupType: S.PATH_GROUP_TYPE.SINGLE,
                  originKind: 'SOURCE' as const,
                  selectionKind: 'FIXED' as const,
                  resultBlock: {
                    id: S.actionId(90, 3) + '__result',
                    resultKind: 'SINGLE' as const,
                    outcomes: [
                      {
                        id: S.actionId(90, 3),
                        effectKind: S.EFFECT_KIND.DAMAGE,
                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                        scalingKind: S.SCALING.NONE,
                        diceConfig: '1d4'
                      }
                    ]
                  }
                }
              ]
            }
          ]
        },
        {
          id: S.actionId(90, 402),
          label: 'Club (Shillelagh)',
          description: '',
          order: 2,
          rollDefinitions: [
            {
              id: S.actionId(90, 451),
              label: 'Shillelagh club attack',
              kind: 'ATTACK',
              expression: { count: 1, die: 20, modifier: 6 },
              rollMode: 'NORMAL',
              chargeCost: null,
              order: 1
            }
          ],
          effects: [
            {
              id: S.actionId(90, 405),
              order: 1,
              invocation: {
                kind: 'ACTION' as const,
                triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                range: {
                  id: S.actionId(90, 406),
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
                  id: S.actionId(90, 407),
                  order: 1,
                  pathCode: S.PATH_CODE.ON_HIT,
                  groupType: S.PATH_GROUP_TYPE.SINGLE,
                  originKind: 'SOURCE' as const,
                  selectionKind: 'FIXED' as const,
                  resultBlock: {
                    id: S.actionId(90, 407) + '__result',
                    resultKind: 'SINGLE' as const,
                    outcomes: [
                      {
                        id: S.actionId(90, 407),
                        effectKind: S.EFFECT_KIND.DAMAGE,
                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                        scalingKind: S.SCALING.NONE,
                        diceConfig: '1d8+4'
                      }
                    ]
                  }
                }
              ]
            }
          ]
        }
      ],
      order: 5
    },
    {
      id: S.featureId(90, 6),
      label: 'Fey Charm',
      description:
        "Fey Charm. The dryad targets one humanoid or beast that she can see within 30 feet of her. If the target can see the dryad, it must succeed on a DC 14 Wisdom saving throw or be magically charmed. The charmed creature regards the dryad as a trusted friend to be heeded and protected. Although the target isn't under the dryad's control, it takes the dryad's requests or actions in the most favorable way it can. Each time the dryad or its allies do anything harmful to the target, it can repeat the saving throw, ending the effect on itself on a success. Otherwise, the effect lasts 24 hours or until the dryad dies, is on a different plane of existence from the target, or ends the effect as a bonus action.",
      effects: [
        {
          id: S.actionId(90, 4),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(90, 7),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM,
              baseDc: 14
            },
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(90, 5),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 30,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(90, 6),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(90, 6) + '__result',
                resultKind: 'SINGLE' as const,
                duration: {
                  id: S.actionId(90, 8),
                  durationKind: DURATION_KIND.HOUR,
                  amount: 24
                },
                outcomes: [
                  {
                    id: S.actionId(90, 6),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('CHARMED')
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
