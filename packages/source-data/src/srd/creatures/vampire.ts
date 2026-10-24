import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import { DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared'
import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'
import * as R from './rollInfluenceGrants.js'

export const vampire: CreatureAuthored = {
  id: S.CREATURE_IDS.VAMPIRE,
  label: 'Vampire',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.UNDEAD,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000700000000',
  tags: ['shapechanger'],
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 18,
    CONSTITUTION: 18,
    INTELLIGENCE: 17,
    WISDOM: 15,
    CHARISMA: 18
  },
  naturalArmorBonus: 2,
  hitPoints: 144,
  details: [],
  damageVulnerabilities: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 17,
    die: 8,
    modifier: 68
  },
  speeds: [...S.walk(30)],
  proficiencies: [
    S.grantedSaveProficiency(277, 1, 'DEXTERITY', 'WISDOM', 'CHARISMA'),
    S.grantedSkillProficiency(277, 2, 'PERCEPTION', 'STEALTH')
  ],
  damageResistances: ['necrotic; bludgeoning, piercing, and slashing from nonmagical attacks'],
  senses: [S.darkvision(120)],
  passivePerception: 17,
  challengeRatingId: S.CR.CR_13,
  xp: 10000,
  features: [
    {
      id: S.featureId(277, 1),
      label: 'Shapechanger',
      description:
        "Shapechanger. If the vampire isn't in sunlight or running water, it can use its action to polymorph into a Tiny bat or a Medium cloud of mist, or back into its true form. While in bat form, the vampire can't speak, its walking speed is 5 feet, and it has a flying speed of 30 feet. Its statistics, other than its size and speed, are unchanged. Anything it is wearing transforms with it, but nothing it is carrying does. It reverts to its true form if it dies. While in mist form, the vampire can't take any actions, speak, or manipulate objects. It is weightless, has a flying speed of 20 feet, can hover, and can enter a hostile creature's space and stop there. In addition, if air can pass through a space, the mist can do so without squeezing, and it can't pass through water. It has advantage on Strength, Dexterity, and Constitution saving throws, and it is immune to all nonmagical damage, except the damage it takes from sunlight.",
      effects: [
        S.closedRuleEffect({
          id: S.actionId(277, 200),
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(277, 201), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_VAMPIRE_SHAPECHANGER
        })
      ],
      order: 1
    },
    {
      id: S.featureId(277, 2),
      ruleDefinitionIds: [S.DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID],
      label: 'Legendary Resistance (3/Day)',
      description:
        'Legendary Resistance (3/Day). If the vampire fails a saving throw, it can choose to succeed instead.',
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.legendaryActionId(277, 21),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.MANUAL,
        amount: 3
      },
      order: 2
    },
    {
      id: S.featureId(277, 3),
      label: 'Misty Escape',
      description:
        "Misty Escape. When it drops to 0 hit points outside its resting place, the vampire transforms into a cloud of mist (as in the Shapechanger trait) instead of falling unconscious, provided that it isn't in sunlight or running water. If it can't transform, it is destroyed. While it has 0 hit points in mist form, it can't revert to its vampire form, and it must reach its resting place within 2 hours or be destroyed. Once in its resting place, it reverts to its vampire form. It is then paralyzed until it regains at least 1 hit point. After spending 1 hour in its resting place with 0 hit points, it regains 1 hit point.",
      effects: [
        S.closedRuleEffect({
          id: S.actionId(277, 204),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(277, 205), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_VAMPIRE_MISTY_ESCAPE
        })
      ],
      order: 3
    },
    {
      id: S.featureId(277, 4),
      label: 'Regeneration',
      description:
        "Regeneration. The vampire regains 20 hit points at the start of its turn if it has at least 1 hit point and isn't in sunlight or running water. If the vampire takes radiant damage or damage from holy water, this trait doesn't function at the start of the vampire's next turn.",
      effects: [
        {
          id: S.actionId(277, 206),
          order: 1,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.START_OF_TURN,
            range: { id: S.actionId(277, 207), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          paths: [
            {
              id: S.actionId(277, 208),
              order: 1,
              pathCode: S.PATH_CODE.PASSIVE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(277, 209),
                resultKind: 'SINGLE',
                gate: { kind: 'TARGET_HIT_POINTS_AT_LEAST', amount: 1 },
                suppressedByDamageTypeIds: [S.damageTypeId('RADIANT')],
                outcomes: [
                  {
                    id: S.actionId(277, 210),
                    effectKind: S.EFFECT_KIND.HEAL,
                    valueKind: 'FIXED',
                    scalingKind: S.SCALING.NONE,
                    amount: 20
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
      id: S.featureId(277, 5),
      label: 'Spider Climb',
      description:
        'Spider Climb. The vampire can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(277, 212),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(277, 213), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_SPIDER_CLIMB
        })
      ],
      order: 5
    },
    {
      id: S.featureId(277, 6),
      label: 'Vampire Weaknesses',
      description: 'Vampire Weaknesses. The vampire has the following flaws:',
      order: 6
    },
    {
      id: S.featureId(277, 7),
      label: 'Forbiddance',
      description:
        "Forbiddance. The vampire can't enter a residence without an invitation from one of the occupants.",
      order: 7
    },
    {
      id: S.featureId(277, 8),
      label: 'Harmed by Running Water',
      description:
        'Harmed by Running Water. The vampire takes 20 acid damage if it ends its turn in running water.',
      effects: [
        {
          id: S.actionId(277, 216),
          order: 1,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(277, 217), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          paths: [
            {
              id: S.actionId(277, 250),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(277, 251),
                resultKind: 'SEQUENCE',
                outcomes: [
                  {
                    id: S.actionId(277, 252),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('ACID'),
                    valueKind: S.DAMAGE_VALUE_KIND.FIXED,
                    scalingKind: S.SCALING.NONE,
                    amount: 20
                  },
                  {
                    id: S.actionId(277, 253),
                    effectKind: S.EFFECT_KIND.CLOSED_RULE,
                    ruleKind: S.CLOSED_RULE_KIND.CREATURE_VAMPIRE_HARMED_BY_RUNNING_WATER
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
      id: S.featureId(277, 9),
      label: 'Stake to the Heart',
      description:
        "Stake to the Heart. If a piercing weapon made of wood is driven into the vampire's heart while the vampire is incapacitated in its resting place, the vampire is paralyzed until the stake is removed.",
      order: 9
    },
    {
      id: S.featureId(277, 10),
      label: 'Sunlight Hypersensitivity',
      description:
        'Sunlight Hypersensitivity. The vampire takes 20 radiant damage when it starts its turn in sunlight. While in sunlight, it has disadvantage on attack rolls and ability checks.',
      grants: R.lightSensitivityGrants(277, 100, true, Object.values(S.ABILITY_CODE)),
      effects: [
        {
          id: S.actionId(277, 220),
          order: 1,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(277, 221), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          paths: [
            {
              id: S.actionId(277, 254),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(277, 255),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(277, 256),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION,
                    label: 'Sunlight Hypersensitivity',
                    instructions:
                      'The vampire takes 20 radiant damage when it starts its turn in sunlight.',
                    reasonCode: MANUAL_ADJUDICATION_REASON.NARRATIVE_JUDGMENT
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
      id: S.featureId(277, 11),
      label: 'Language Knowledge',
      description: 'the languages it knew in life',
      order: 11
    },
    {
      id: S.featureId(277, 12),
      label: 'Multiattack (Vampire Form Only)',
      description:
        'Multiattack (Vampire Form Only). The vampire makes two attacks, only one of which can be a bite attack.',
      attackSlots: {
        alternatives: [
          {
            slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(277, 13) }] }]
          },
          {
            slots: [
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(277, 13) }] },
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(277, 14) }] }
            ]
          }
        ]
      },
      order: 12
    },
    {
      id: S.featureId(277, 13),
      label: 'Unarmed Strike (Vampire Form Only)',
      description:
        'Melee Weapon Attack: +9 to hit, reach 5 ft., one creature. Hit: 8 (1d8 + 4) bludgeoning damage. Instead of dealing damage, the vampire can grapple the target (escape DC 18).',
      effects: [
        {
          id: S.actionId(277, 224),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.UNARMED_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(277, 225),
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
              id: S.actionId(277, 226),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.CHOICE,
              originKind: 'SOURCE',
              selectionKind: 'CHOICE',
              options: [
                {
                  id: S.actionId(277, 229),
                  order: 1,
                  label: 'Damage',
                  description: 'Deals 8 (1d8 + 4) bludgeoning damage.',
                  resultBlock: {
                    id: S.actionId(277, 227),
                    resultKind: 'SINGLE',
                    outcomes: [
                      {
                        id: S.actionId(277, 228),
                        effectKind: S.EFFECT_KIND.DAMAGE,
                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                        scalingKind: S.SCALING.NONE,
                        diceConfig: '1d8+4'
                      }
                    ]
                  }
                },
                {
                  id: S.actionId(277, 258),
                  order: 2,
                  label: 'Grapple',
                  description: 'Instead of dealing damage, grapples the target (escape DC 18).',
                  resultBlock: {
                    id: S.actionId(277, 259),
                    resultKind: 'SINGLE',
                    outcomes: [
                      S.grappledOutcome(277, { localIndex: 1, escapeDc: 18, heldAtOnce: 1 })
                    ]
                  }
                }
              ]
            }
          ]
        }
      ],
      order: 13
    },
    {
      id: S.featureId(277, 14),
      label: 'Bite (Bat or Vampire Form Only)',
      description:
        "Melee Weapon Attack: +9 to hit, reach 5 ft., one willing creature, or a creature that is grappled by the vampire, incapacitated, or restrained. Hit: 7 (1d6 + 4) piercing damage plus 10 (3d6) necrotic damage. The target's hit point maximum is reduced by an amount equal to the necrotic damage taken, and the vampire regains hit points equal to that amount. The reduction lasts until the target finishes a long rest. The target dies if this effect reduces its hit point maximum to 0. A humanoid slain in this way and then buried in the ground rises the following night as a vampire spawn under the vampire's control.",
      effects: [
        {
          id: S.actionId(277, 230),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(277, 231),
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
              id: S.actionId(277, 232),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(277, 233),
                resultKind: 'SEQUENCE',
                outcomes: [
                  {
                    id: S.actionId(277, 234),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6+4'
                  },
                  {
                    id: S.actionId(277, 235),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('NECROTIC'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '3d6'
                  },
                  {
                    id: S.actionId(277, 236),
                    effectKind: S.EFFECT_KIND.CLOSED_RULE,
                    ruleKind: S.CLOSED_RULE_KIND.CREATURE_VAMPIRE_BITE
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 14
    },
    {
      id: S.featureId(277, 15),
      label: 'Charm',
      description:
        "Charm. The vampire targets one humanoid it can see within 30 feet of it. If the target can see the vampire, the target must succeed on a DC 17 Wisdom saving throw against this magic or be charmed by the vampire. The charmed target regards the vampire as a trusted friend to be heeded and protected. Although the target isn't under the vampire's control, it takes the vampire's requests or actions in the most favorable way it can, and it is a willing target for the vampire's bite attack. Each time the vampire or the vampire's companions do anything harmful to the target, it can repeat the saving throw, ending the effect on itself on a success. Otherwise, the effect lasts 24 hours or until the vampire is destroyed, is on a different plane of existence than the target, or takes a bonus action to end the effect.",
      effects: [
        {
          id: S.actionId(277, 237),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(277, 238),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM,
              baseDc: 17
            },
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(277, 239),
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
              id: S.actionId(277, 260),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(277, 261),
                resultKind: 'SEQUENCE' as const,
                duration: {
                  id: S.actionId(277, 262),
                  durationKind: DURATION_KIND.HOUR,
                  amount: 24
                },
                outcomes: [
                  {
                    id: S.actionId(277, 263),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('CHARMED')
                  },
                  {
                    // Each time the vampire or its companions do anything harmful to the target,
                    // it repeats the save; no save at the end of its turns.
                    id: S.actionId(277, 264),
                    effectKind: S.EFFECT_KIND.FOLLOW_UP_SAVE,
                    timing: S.FOLLOW_UP_SAVE_TIMING.ON_TRIGGERS_ONLY,
                    repeatTriggers: [{ kind: 'DAMAGE_TAKEN' as const, by: 'SOURCE_SIDE' as const }],
                    savingThrow: {
                      id: S.actionId(277, 265),
                      dcMethod: 'FIXED_DC' as const,
                      abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM,
                      baseDc: 17
                    },
                    attempts: { kind: 'ONCE' as const, repeatOnFailure: true },
                    onSuccess: { kind: 'END' as const },
                    onFailure: { kind: 'CONTINUE' as const }
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 15
    },
    {
      id: S.featureId(277, 16),
      label: 'Children of the Night (1/Day)',
      description:
        "Children of the Night (1/Day). The vampire magically calls 2d4 swarms of bats or rats, provided that the sun isn't up. While outdoors, the vampire can call 3d6 wolves instead. The called creatures arrive in 1d4 rounds, acting as allies of the vampire and obeying its spoken commands. The beasts remain for 1 hour, until the vampire dies, or until the vampire dismisses them as a bonus action.",
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.legendaryActionId(277, 22),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.MANUAL,
        amount: 1
      },
      effects: [
        S.closedRuleEffect({
          id: S.actionId(277, 240),
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: { id: S.actionId(277, 241), rangeKind: S.RANGE_KIND.SPECIAL }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_VAMPIRE_CHILDREN_OF_THE_NIGHT
        })
      ],
      order: 16
    },
    {
      id: S.featureId(277, 17),
      options: [
        {
          id: '00000000-0005-00c9-0070-011500000000',
          label: 'Move',
          description: 'The vampire moves up to its speed without provoking opportunity attacks.',
          order: 1,
          // A legendary action's cost and window are the Feature's own economy, which no granted
          // action expresses, so the GM runs the move (D187a).
          effects: [
            S.manualAdjudicationEffect({
              id: '00000000-0002-00f2-0070-011500000000',
              invocation: {
                kind: 'PASSIVE',
                triggerCode: 'ACTIVATED',
                range: { id: '00000000-0002-00f3-0070-011500000000', rangeKind: 'SELF' },
                targeting: { selectionKind: 'SELF' }
              },
              label: 'Move without provoking opportunity attacks',
              reasonCode: 'GM_CHOICE',
              instructions:
                'The vampire moves up to its speed without provoking opportunity attacks.'
            })
          ]
        },
        {
          id: '00000000-0005-00ca-0070-011500000000',
          label: 'Unarmed Strike',
          description: 'The vampire makes one unarmed strike.',
          order: 2,
          actionReference: { featureId: S.featureId(277, 13), chargeCost: 1 }
        },
        {
          id: '00000000-0005-00cb-0070-011500000000',
          label: 'Bite (Costs 2 Actions)',
          description: 'The vampire makes one bite attack.',
          order: 3,
          actionReference: { featureId: S.featureId(277, 14), chargeCost: 2 }
        }
      ],
      ruleDefinitionIds: [S.DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID],
      label: 'Legendary Actions',
      section: 'LEGENDARY_ACTION',
      description:
        "The vampire can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The vampire regains spent legendary actions at the start of its turn.",
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.legendaryActionId(277, 23),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.MANUAL,
        amount: 3
      },
      order: 17
    }
  ]
}
