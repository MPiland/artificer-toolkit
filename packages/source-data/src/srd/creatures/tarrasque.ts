import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'
export const tarrasque: CreatureAuthored = {
  id: S.CREATURE_IDS.TARRASQUE,
  label: 'Tarrasque',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.GARGANTUAN,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  tags: ['titan'],
  abilityScores: {
    STRENGTH: 30,
    DEXTERITY: 11,
    CONSTITUTION: 30,
    INTELLIGENCE: 3,
    WISDOM: 11,
    CHARISMA: 11
  },
  naturalArmorBonus: 15,
  hitPoints: 676,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 33,
    die: 20,
    modifier: 330
  },
  speeds: [...S.walk(40)],
  proficiencies: [S.grantedSaveProficiency(268, 1, 'INTELLIGENCE', 'WISDOM', 'CHARISMA')],
  damageImmunities: [
    'fire',
    'poison',
    'bludgeoning, piercing, and slashing from nonmagical attacks'
  ],
  conditionImmunities: ['charmed', 'frightened', 'paralyzed', 'poisoned'],
  senses: [S.blindsight(120)],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_30,
  xp: 155000,
  features: [
    {
      id: S.featureId(268, 1),
      ruleDefinitionIds: [S.DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID],
      label: 'Legendary Resistance (3/Day)',
      description:
        'Legendary Resistance (3/Day). If the tarrasque fails a saving throw, it can choose to succeed instead.',
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.actionId(268, 200),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.LONG_REST,
        amount: 3
      },
      order: 1
    },
    {
      id: S.featureId(268, 2),
      label: 'Reflective Carapace',
      description:
        'Reflective Carapace. Any time the tarrasque is targeted by a magic missile spell, a line spell, or a spell that requires a ranged attack roll, roll a d6. On a 1 to 5, the tarrasque is unaffected. On a 6, the tarrasque is unaffected, and the effect is reflected back at the caster as though it originated from the tarrasque, turning the caster into the target.',
      order: 2
    },
    {
      id: S.featureId(268, 3),
      label: 'Siege Monster',
      description: 'Siege Monster. The tarrasque deals double damage to objects and structures.',
      effects: [
        S.manualAdjudicationEffect({
          id: S.actionId(268, 205),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(268, 206), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          label: 'Siege Monster',
          reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
          instructions:
            'The tarrasque deals double damage to objects and structures: the GM doubles the damage its attacks deal to an object or structure.'
        })
      ],
      order: 3
    },
    {
      id: S.featureId(268, 4),
      label: 'Multiattack',
      description:
        'Multiattack. The tarrasque can use its Frightful Presence. It then makes five attacks: one with its bite, two with its claws, one with its horns, and one with its tail. It can use its Swallow instead of its bite.',
      attackSlots: {
        alternatives: [
          {
            slots: [
              {
                count: 1,
                fillers: [{ kind: 'FEATURE', featureId: S.featureId(268, 9) }],
                optional: true,
                comesFirst: true
              },
              {
                count: 1,
                fillers: [
                  { kind: 'FEATURE', featureId: S.featureId(268, 5) },
                  { kind: 'FEATURE', featureId: S.featureId(268, 10) }
                ]
              },
              { count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(268, 6) }] },
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(268, 7) }] },
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(268, 8) }] }
            ]
          }
        ]
      },
      order: 4
    },
    {
      id: S.featureId(268, 5),
      label: 'Bite',
      description:
        'Bite. Melee Weapon Attack: +19 to hit, reach 10 ft., one target. Hit: 36 (4d12 + 10) piercing damage. If the target is a creature, it is grappled (escape DC 20).',
      effects: [
        {
          id: S.actionId(2982, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(2982, 2),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 10,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(2982, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(2982, 3) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(2982, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '4d12+10'
                  },
                  S.grappledOutcome(268, {
                    localIndex: 1,
                    escapeDc: 20,
                    heldAtOnce: 1,
                    untilEnds: ['RESTRAINED']
                  })
                ]
              }
            }
          ]
        }
      ],
      order: 5
    },
    {
      id: S.featureId(268, 6),
      label: 'Claw',
      description:
        'Claw. Melee Weapon Attack: +19 to hit, reach 15 ft., one target. Hit: 28 (4d8 + 10) slashing damage.',
      effects: [
        {
          id: S.actionId(268, 209),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(268, 210),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 15,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(268, 211),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(268, 212),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(268, 213),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '4d8+10'
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 6
    },
    {
      id: S.featureId(268, 7),
      label: 'Horns',
      description:
        'Horns. Melee Weapon Attack: +19 to hit, reach 10 ft., one target. Hit: 32 (4d10 + 10) piercing damage.',
      effects: [
        {
          id: S.actionId(268, 214),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(268, 215),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 10,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(268, 216),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(268, 217),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(268, 218),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '4d10+10'
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
      id: S.featureId(268, 8),
      label: 'Tail',
      description:
        'Tail. Melee Weapon Attack: +19 to hit, reach 20 ft., one target. Hit: 24 (4d6 + 10) bludgeoning damage. If the target is a creature, it must succeed on a DC 20 Strength saving throw or be knocked prone.',
      effects: [
        {
          id: S.actionId(268, 219),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(268, 220),
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
              id: S.actionId(268, 221),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(268, 222),
                resultKind: 'SEQUENCE',
                outcomes: [
                  {
                    id: S.actionId(268, 223),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '4d6+10'
                  },
                  S.conditionSave({
                    id: S.actionId(268, 224),
                    savingThrowId: S.actionId(268, 1301),
                    ability: 'STRENGTH',
                    dc: 20,
                    conditionOutcomeId: S.actionId(268, 1302),
                    conditionId: conditionTypeId('PRONE'),
                    repeatsAtTurnEnd: false
                  })
                ]
              }
            }
          ]
        }
      ],
      order: 8
    },
    {
      id: S.featureId(268, 9),
      label: 'Frightful Presence',
      description:
        "Frightful Presence. Each creature of the tarrasque's choice within 120 feet of it and aware of it must succeed on a DC 17 Wisdom saving throw or become frightened for 1 minute. A creature can repeat the saving throw at the end of each of its turns, with disadvantage if the tarrasque is within line of sight, ending the effect on itself on a success. If a creature's saving throw is successful or the effect ends for it, the creature is immune to the tarrasque's Frightful Presence for the next 24 hours.",
      effects: [
        S.minuteFearSaveEffect(268, {
          localIndex: 2000,
          dc: 17,
          reach: { chosenWithinFeet: 120 },
          repeatRollInfluence: {
            influence: 'DISADVANTAGE',
            when: { kind: 'PERCEPTION', observer: 'TARGET', subject: 'SOURCE', requirement: 'SEE' }
          }
        })
      ],
      order: 9
    },
    {
      id: S.featureId(268, 10),
      label: 'Swallow',
      description:
        "Swallow. The tarrasque makes one bite attack against a Large or smaller creature it is grappling. If the attack hits, the target takes the bite's damage, the target is swallowed, and the grapple ends. While swallowed, the creature is blinded and restrained, it has total cover against attacks and other effects outside the tarrasque, and it takes 56 (16d6) acid damage at the start of each of the tarrasque's turns. If the tarrasque takes 60 damage or more on a single turn from a creature inside it, the tarrasque must succeed on a DC 20 Constitution saving throw at the end of that turn or regurgitate all swallowed creatures, which fall prone in a space within 10 feet of the tarrasque. If the tarrasque dies, a swallowed creature is no longer restrained by it and can escape from the corpse by using 30 feet of movement, exiting prone.",
      effects: [
        {
          id: S.actionId(268, 228),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(268, 229),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 10,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY,
              heldBySource: true as const
            }
          },
          paths: [
            {
              id: S.actionId(268, 231),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(268, 231) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(268, 231),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '4d12+10'
                  }
                ]
              }
            },
            {
              id: S.actionId(268, 230),
              order: 2,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(268, 230) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  S.swallowedOutcome(268, {
                    localIndex: 10,
                    damageOutcomeId: S.actionId(268, 232),
                    escapeDc: 20,
                    heldAtOnce: 1,
                    largestTarget: S.SIZE_CODE.LARGE,
                    damageType: 'ACID',
                    diceConfig: '16d6'
                  })
                ]
              }
            }
          ]
        }
      ],
      order: 10
    },
    {
      id: S.featureId(268, 11),
      label: 'Magic Resistance',
      description:
        'Magic Resistance. The tarrasque has advantage on saving throws against spells and other magical effects.',
      grants: S.magicResistanceGrants(268, 901),
      order: 11
    }
  ]
}
