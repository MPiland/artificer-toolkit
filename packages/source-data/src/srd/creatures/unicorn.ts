import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { chargeEffect } from './chargeEffect.js'
import * as S from './shared.js'
export const unicorn: CreatureAuthored = {
  id: S.CREATURE_IDS.UNICORN,
  label: 'Unicorn',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.CELESTIAL,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000100000000',
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 14,
    CONSTITUTION: 15,
    INTELLIGENCE: 11,
    WISDOM: 17,
    CHARISMA: 16
  },
  naturalArmorBonus: 0,
  hitPoints: 67,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 9,
    die: 10,
    modifier: 18
  },
  speeds: [...S.walk(50)],
  proficiencies: [S.grantedLanguageProficiency(276, 1, 'CELESTIAL', 'ELVISH', 'SYLVAN')],
  damageImmunities: ['poison'],
  conditionImmunities: ['charmed', 'paralyzed', 'poisoned'],
  senses: [S.darkvision(60)],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_5,
  xp: 1800,
  features: [
    {
      id: S.featureId(276, 1),
      label: 'Charge',
      description:
        'Charge. If the unicorn moves at least 20 feet straight toward a target and then hits it with a horn attack on the same turn, the target takes an extra 9 (2d8) piercing damage. If the target is a creature, it must succeed on a DC 15 Strength saving throw or be knocked prone.',
      effects: [
        chargeEffect({
          creatureIndex: 276,
          localIndex: 300,
          ridesFeatureId: S.featureId(276, 8),
          minFeet: 20,
          damageType: 'PIERCING',
          diceConfig: '2d8',
          dc: 15
        })
      ],
      order: 1
    },
    {
      id: S.featureId(276, 2),
      label: 'Innate Spellcasting',
      description:
        "Innate Spellcasting. The unicorn's innate spellcasting ability is Charisma (spell save DC 14). The unicorn can innately cast the following spells, requiring no components: At will: detect evil and good, druidcraft, pass without trace 1/day each: calm emotions, dispel evil and good, entangle",
      grants: {
        spells: [
          {
            id: S.featureId(276, 220),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [
              S.SPELL_IDS.DETECT_EVIL_AND_GOOD,
              S.SPELL_IDS.DRUIDCRAFT,
              S.SPELL_IDS.PASS_WITHOUT_TRACE
            ],
            attributes: [S.SPELL_GRANT_ATTRIBUTE.KNOWN, S.SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            order: 0
          },
          ...[
            S.SPELL_IDS.CALM_EMOTIONS,
            S.SPELL_IDS.DISPEL_EVIL_AND_GOOD,
            S.SPELL_IDS.ENTANGLE
          ].map((spellId, index) => ({
            id: S.featureId(276, 221 + index),
            grantKind: S.GRANT_KIND.SPELL_GRANT,
            selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: S.SCALING.NONE,
            authoringModeKind: S.AUTHORING_MODE_KIND.SELECTED,
            spellIds: [spellId],
            attributes: [S.SPELL_GRANT_ATTRIBUTE.KNOWN, S.SPELL_GRANT_ATTRIBUTE.LIMITED_USE],
            castingAbility: S.ABILITY_CODE.CHARISMA,
            charges: {
              id: S.featureId(276, 230 + index),
              limitKind: 'FIXED_AMOUNT' as const,
              scalingKind: S.SCALING.NONE,
              resetKind: S.CHARGE_RESET_KIND.LONG_REST,
              amount: 1
            },
            order: index + 1
          }))
        ]
      },
      order: 2
    },
    {
      id: S.featureId(276, 3),
      label: 'Magic Resistance',
      description:
        'Magic Resistance. The unicorn has advantage on saving throws against spells and other magical effects.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(276, 204),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(276, 205), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_MAGIC_RESISTANCE
        })
      ],
      order: 3
    },
    {
      id: S.featureId(276, 4),
      label: 'Magic Weapons',
      description: "Magic Weapons. The unicorn's weapon attacks are magical.",
      grants: S.magicWeaponsGrants(276, 206),
      order: 4
    },
    {
      id: S.featureId(276, 5),
      label: 'Telepathy',
      description: 'telepathy 60 ft.',
      order: 5
    },
    {
      id: S.featureId(276, 6),
      label: 'Multiattack',
      description:
        'Multiattack. The unicorn makes two attacks: one with its hooves and one with its horn.',
      attackSlots: {
        alternatives: [
          {
            slots: [
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(276, 7) }] },
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(276, 8) }] }
            ]
          }
        ]
      },
      order: 6
    },
    {
      id: S.featureId(276, 7),
      label: 'Hooves',
      description:
        'Hooves. Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 11 (2d6 + 4) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(276, 2),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(276, 8),
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
              id: S.actionId(276, 9),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(276, 9) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(276, 9),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6',
                    bonuses: [
                      {
                        id: S.actionId(276, 10),
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
      order: 7
    },
    {
      id: S.featureId(276, 8),
      label: 'Horn',
      description:
        'Horn. Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 8 (1d8 + 4) piercing damage.',
      effects: [
        {
          id: S.actionId(276, 3),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(276, 11),
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
              id: S.actionId(276, 12),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(276, 12) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(276, 12),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d8',
                    bonuses: [
                      {
                        id: S.actionId(276, 13),
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
      order: 8
    },
    {
      id: S.featureId(276, 9),
      label: 'Healing Touch (3/Day)',
      description:
        'Healing Touch (3/Day). The unicorn touches another creature with its horn. The target magically regains 11 (2d8 + 2) hit points. In addition, the touch removes all diseases and neutralizes all poisons afflicting the target.',
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.actionId(276, 14),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.MANUAL,
        amount: 3
      },
      effects: [
        {
          id: S.actionId(276, 4),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(276, 15),
              rangeKind: S.RANGE_KIND.TOUCH
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY,
              self: 'WARN'
            }
          },
          paths: [
            {
              id: S.actionId(276, 16),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(276, 16) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(276, 16),
                    effectKind: S.EFFECT_KIND.HEAL,
                    valueKind: 'FIXED',
                    amount: 11,
                    scalingKind: S.SCALING.NONE
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 9
    },
    {
      id: S.featureId(276, 10),
      label: 'Teleport (1/Day)',
      description:
        'Teleport (1/Day). The unicorn magically teleports itself and up to three willing creatures it can see within 5 feet of it, along with any equipment they are wearing or carrying, to a location the unicorn is familiar with, up to 1 mile away.',
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.actionId(276, 17),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.MANUAL,
        amount: 1
      },
      effects: [
        {
          id: S.actionId(276, 5),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(276, 18),
              rangeKind: S.RANGE_KIND.SPECIAL
            }
          },
          paths: [
            {
              id: S.actionId(276, 19),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(276, 19) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(276, 19),
                    effectKind: S.EFFECT_KIND.TELEPORT,
                    targetKind: 'CHOSEN_CREATURES',
                    destinationKind: 'SPECIAL'
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 10
    },
    {
      id: S.featureId(276, 11),
      options: [
        {
          id: '00000000-0005-00c9-0070-011400000000',
          label: 'Hooves',
          description: 'The unicorn makes one attack with its hooves.',
          order: 1,
          actionReference: { featureId: S.featureId(276, 7), chargeCost: 1 }
        },
        {
          id: '00000000-0005-00ca-0070-011400000000',
          label: 'Shimmering Shield (Costs 2 Actions)',
          description:
            "The unicorn creates a shimmering, magical field around itself or another creature it can see within 60 feet of it. The target gains a +2 bonus to AC until the end of the unicorn's next turn.",
          order: 2,
          effects: [
            {
              id: '00000000-0005-0006-0070-011400000000',
              order: 2,
              invocation: {
                kind: 'ACTION',
                triggerCode: 'ACTIVATED',
                activation: { code: 'FREE' },
                range: {
                  id: '00000000-0005-0007-0070-011400000000',
                  rangeKind: 'DISTANCE',
                  amount: 60,
                  unit: 'FEET'
                },
                targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' },
                resourceUse: { chargeId: '00000000-0005-0001-0070-011400000000', cost: 2 }
              },
              paths: [
                {
                  id: '00000000-0005-0008-0070-011400000000',
                  order: 1,
                  pathCode: 'ON_USE',
                  groupType: 'SINGLE',
                  originKind: 'SOURCE',
                  selectionKind: 'FIXED',
                  resultBlock: {
                    id: '00000000-0005-0008-0070-011400000000__result',
                    resultKind: 'SINGLE',
                    duration: {
                      id: '00000000-0005-0010-0070-011400000000',
                      durationKind: 'ROUND',
                      amount: 1
                    },
                    lifecycle: { turnAnchor: { actor: 'SOURCE', boundary: 'END_OF_TURN' } },
                    outcomes: [
                      {
                        id: '00000000-0005-0008-0070-011400000000',
                        effectKind: 'APPLY_GRANT',
                        grants: {
                          modifiers: [
                            {
                              id: '00000000-0005-0011-0070-011400000000',
                              grantKind: 'MODIFIER_GRANT',
                              valueDomainCode: 'ARMOR_CLASS',
                              domain: {},
                              modifierKind: 'BONUS',
                              scope: 'GLOBAL',
                              selectionKind: 'GRANTED',
                              payload: { valueKind: 'FIXED', amount: 2 },
                              order: 1
                            }
                          ]
                        }
                      }
                    ]
                  }
                }
              ]
            }
          ]
        },
        {
          id: '00000000-0005-00cb-0070-011400000000',
          label: 'Heal Self (Costs 3 Actions)',
          description: 'The unicorn magically regains 11 (2d8 + 2) hit points.',
          order: 3,
          effects: [
            {
              id: '00000000-0005-0009-0070-011400000000',
              order: 3,
              invocation: {
                kind: 'ACTION',
                triggerCode: 'ACTIVATED',
                activation: { code: 'FREE' },
                range: { id: '00000000-0005-000a-0070-011400000000', rangeKind: 'SPECIAL' },
                resourceUse: { chargeId: '00000000-0005-0001-0070-011400000000', cost: 3 }
              },
              paths: [
                {
                  id: '00000000-0005-000b-0070-011400000000',
                  order: 1,
                  pathCode: 'ON_USE',
                  groupType: 'SINGLE',
                  originKind: 'SOURCE',
                  selectionKind: 'FIXED',
                  resultBlock: {
                    id: '00000000-0005-000b-0070-011400000000__result',
                    resultKind: 'SINGLE',
                    outcomes: [
                      {
                        id: '00000000-0005-000b-0070-011400000000',
                        effectKind: 'HEAL',
                        valueKind: 'FIXED',
                        amount: 11,
                        scalingKind: 'NONE'
                      }
                    ]
                  }
                }
              ]
            }
          ]
        }
      ],
      ruleDefinitionIds: [S.DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID],
      label: 'Legendary Actions',
      section: 'LEGENDARY_ACTION',
      description:
        "The unicorn can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The unicorn regains spent legendary actions at the start of its turn.",
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.legendaryActionId(276, 1),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.MANUAL,
        amount: 3
      },
      order: 11
    }
  ]
}
