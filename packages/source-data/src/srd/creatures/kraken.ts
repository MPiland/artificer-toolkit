import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import {
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  MANUAL_ADJUDICATION_REASON,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  VALUE_DOMAIN_CODE
} from '@artificer-toolkit/shared/core'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { sourceTraitRestriction } from '../classes/mechanics.js'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'
export const kraken: CreatureAuthored = {
  id: S.CREATURE_IDS.KRAKEN,
  label: 'Kraken',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
  size: S.SIZE_CODE.GARGANTUAN,
  alignmentId: '00000000-0000-0000-0001-000900000000',
  tags: ['titan'],
  abilityScores: {
    STRENGTH: 30,
    DEXTERITY: 11,
    CONSTITUTION: 25,
    INTELLIGENCE: 22,
    WISDOM: 18,
    CHARISMA: 20
  },
  naturalArmorBonus: 8,
  hitPoints: 472,
  details: [],
  damageVulnerabilities: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 27,
    die: 20,
    modifier: 189
  },
  speeds: [...S.walk(20), ...S.swim(60)],
  proficiencies: [
    S.grantedSaveProficiency(
      9001,
      1,
      'STRENGTH',
      'DEXTERITY',
      'CONSTITUTION',
      'INTELLIGENCE',
      'WISDOM'
    ),
    S.grantedLanguageProficiency(9001, 3, 'ABYSSAL', 'CELESTIAL', 'INFERNAL', 'PRIMORDIAL')
  ],
  damageImmunities: ['lightning', 'bludgeoning, piercing, and slashing from nonmagical attacks'],
  conditionImmunities: ['frightened', 'paralyzed'],
  senses: [S.truesight(120)],
  passivePerception: 14,
  challengeRatingId: S.CR.CR_23,
  xp: 50000,
  features: [
    {
      id: S.featureId(180, 9),
      label: 'Telepathy',
      description: 'telepathy 120 ft.',
      order: 0
    },
    {
      id: S.featureId(180, 1),
      label: 'Amphibious',
      description: 'Amphibious. The kraken can breathe air and water.',
      order: 1
    },
    {
      id: S.featureId(180, 2),
      label: 'Freedom of Movement',
      description:
        "Freedom of Movement. The kraken ignores difficult terrain, and magical effects can't reduce its speed or cause it to be restrained. It can spend 5 feet of movement to escape from nonmagical restraints or being grappled.",
      // Magical effects can't cause it to be restrained: a source-trait condition immunity, as the spell's.
      grants: {
        modifiers: [
          {
            id: S.grantId(180, 1),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.CONDITION_IMMUNITY,
            domain: {},
            modifierKind: MODIFIER_KIND.ADD_OPTION,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { conditionTypeId: conditionTypeId('RESTRAINED') },
            restrictions: sourceTraitRestriction((entry) => S.grantId(180, 10 + entry), 'INCLUDE', [
              'MAGICAL'
            ]),
            order: 0
          }
        ]
      },
      effects: [
        S.manualAdjudicationEffect({
          id: S.actionId(180, 502),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(180, 602), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          label: 'Freedom of Movement',
          reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
          instructions:
            "The kraken ignores difficult terrain, and magical effects can't reduce its speed. It can spend 5 feet of movement to escape from nonmagical restraints or being grappled."
        })
      ],
      order: 2
    },
    {
      id: S.featureId(180, 4),
      label: 'Siege Monster',
      description: 'Siege Monster. The kraken deals double damage to objects and structures.',
      effects: [
        S.manualAdjudicationEffect({
          id: S.actionId(180, 503),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            range: { id: S.actionId(180, 603), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          label: 'Siege Monster',
          reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
          instructions:
            'The kraken deals double damage to objects and structures: the GM doubles the damage its attacks deal to an object or structure.'
        })
      ],
      order: 4
    },
    {
      id: S.featureId(180, 5),
      label: 'Multiattack',
      description:
        'Multiattack. The kraken makes three tentacle attacks, each of which it can replace with one use of Fling.',
      attackSlots: {
        alternatives: [
          { slots: [{ count: 3, fillers: [{ kind: 'FEATURE', featureId: S.featureId(180, 6) }] }] }
        ]
      },
      order: 5
    },
    {
      id: S.featureId(180, 6),
      label: 'Tentacle',
      description:
        'Tentacle. Melee Weapon Attack: +17 to hit, reach 30 ft., one target. Hit: 20 (3d6 + 10) bludgeoning damage, and the target is grappled (escape DC 18). Until this grapple ends, the target is restrained. The kraken has ten tentacles, each of which can grapple one target.',
      effects: [
        {
          id: S.actionId(9001, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(9001, 2),
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
              id: S.actionId(9001, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(9001, 3) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(9001, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '3d6',
                    bonuses: [
                      {
                        id: S.actionId(9001, 4),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.STRENGTH,
                        order: 1
                      }
                    ]
                  },
                  S.grappledOutcome(180, {
                    localIndex: 1,
                    escapeDc: 18,
                    heldAtOnce: 10,
                    untilEnds: ['RESTRAINED']
                  })
                ]
              }
            }
          ]
        }
      ],
      order: 6
    },
    {
      id: S.featureId(180, 7),
      label: 'Bite',
      description:
        "Bite. Melee Weapon Attack: +17 to hit, reach 5 ft., one target. Hit: 23 (3d8 + 10) piercing damage. If the target is a Large or smaller creature grappled by the kraken, that creature is swallowed, and the grapple ends. While swallowed, the creature is blinded and restrained, it has total cover against attacks and other effects outside the kraken, and it takes 42 (12d6) acid damage at the start of each of the kraken's turns. If the kraken takes 50 damage or more on a single turn from a creature inside it, the kraken must succeed on a DC 25 Constitution saving throw at the end of that turn or regurgitate all swallowed creatures, which fall prone in a space within 10 feet of the kraken. If the kraken dies, a swallowed creature is no longer restrained by it and can escape from the corpse using 15 feet of movement, exiting prone.",
      effects: [
        {
          id: S.actionId(9001, 5),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(9001, 6),
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
              id: S.actionId(9001, 7),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(9001, 7) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(9001, 7),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '3d8',
                    bonuses: [
                      {
                        id: S.actionId(9001, 8),
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
        },
        {
          // "grappled by the kraken": the same bite, swallowing the creature it holds.
          id: S.actionId(9001, 20),
          order: 2,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(9001, 21),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 5,
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
              id: S.actionId(9001, 22),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(9001, 22) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(9001, 22),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '3d8',
                    bonuses: [
                      {
                        id: S.actionId(9001, 23),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.STRENGTH,
                        order: 1
                      }
                    ]
                  },
                  S.swallowedOutcome(180, {
                    localIndex: 10,
                    damageOutcomeId: S.actionId(9001, 24),
                    escapeDc: 18,
                    heldAtOnce: 10,
                    largestTarget: S.SIZE_CODE.LARGE,
                    damageType: 'ACID',
                    diceConfig: '12d6'
                  })
                ]
              }
            }
          ]
        }
      ],
      order: 7
    },
    {
      id: S.featureId(180, 10),
      label: 'Fling',
      description:
        'Fling. One Large or smaller object held or creature grappled by the kraken is thrown up to 60 feet in a random direction and knocked prone. If a thrown target strikes a solid surface, the target takes 3 (1d6) bludgeoning damage for every 10 feet it was thrown. If the target is thrown at another creature, that creature must succeed on a DC 18 Dexterity saving throw or take the same damage and be knocked prone.',
      order: 8
    },
    {
      id: S.featureId(180, 8),
      label: 'Lightning Storm',
      description:
        'Lightning Storm. The kraken magically creates three bolts of lightning, each of which can strike a target the kraken can see within 120 feet of it. A target must make a DC 23 Dexterity saving throw, taking 22 (4d10) lightning damage on a failed save, or half as much damage on a successful one.',
      effects: [
        {
          id: S.actionId(180, 506),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.SAVING_THROW,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            savingThrow: {
              id: S.actionId(180, 606),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.DEXTERITY,
              baseDc: 23
            },
            range: {
              id: S.actionId(180, 607),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 120,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.CHOSEN_CREATURES,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY,
              maxTargets: 3
            }
          },
          paths: [
            {
              id: S.actionId(180, 806),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(180, 806) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(180, 960),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('LIGHTNING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '4d10'
                  }
                ]
              }
            },
            {
              id: S.actionId(180, 807),
              order: 2,
              pathCode: S.PATH_CODE.ON_SAVE_SUCCESS,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(180, 807) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(180, 970),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('LIGHTNING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '4d10',
                    multiplier: 0.5
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 9
    }
  ]
}
