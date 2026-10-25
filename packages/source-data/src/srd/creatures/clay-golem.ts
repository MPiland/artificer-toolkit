import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const clayGolem: CreatureAuthored = {
  id: S.CREATURE_IDS.CLAY_GOLEM,
  label: 'Clay Golem',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.CONSTRUCT,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 20,
    DEXTERITY: 9,
    CONSTITUTION: 18,
    INTELLIGENCE: 3,
    WISDOM: 8,
    CHARISMA: 1
  },
  naturalArmorBonus: 5,
  hitPoints: 133,
  details: [],
  proficiencies: [],
  damageVulnerabilities: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 14,
    die: 10,
    modifier: 56
  },
  speeds: [...S.walk(20)],
  damageImmunities: [
    'acid',
    'poison',
    'psychic',
    "bludgeoning, piercing, and slashing from nonmagical attacks that aren't adamantine"
  ],
  conditionImmunities: [
    'charmed',
    'exhaustion',
    'frightened',
    'paralyzed',
    'petrified',
    'poisoned'
  ],
  senses: [S.darkvision(60)],
  passivePerception: 9,
  challengeRatingId: S.CR.CR_9,
  xp: 5000,
  features: [
    {
      id: S.featureId(64, 1),
      label: 'Berserk',
      description:
        'Berserk. Whenever the golem starts its turn with 60 hit points or fewer, roll a d6. On a 6, the golem goes berserk. On each of its turns while berserk, the golem attacks the nearest creature it can see. If no creature is near enough to move to and attack, the golem attacks an object, with preference for an object smaller than itself. Once the golem goes berserk, it continues to do so until it is destroyed or regains all its hit points.',
      order: 1
    },
    {
      id: S.featureId(64, 2),
      label: 'Immutable Form',
      description:
        'Immutable Form. The golem is immune to any spell or effect that would alter its form.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(64, 103),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(64, 104), rangeKind: S.RANGE_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_IMMUTABLE_FORM
        })
      ],
      order: 2
    },
    {
      id: S.featureId(64, 3),
      label: 'Magic Resistance',
      description:
        'Magic Resistance. The golem has advantage on saving throws against spells and other magical effects.',
      grants: S.magicResistanceGrants(64, 105),
      order: 3
    },
    {
      id: S.featureId(64, 4),
      label: 'Magic Weapons',
      description: "Magic Weapons. The golem's weapon attacks are magical.",
      grants: S.magicWeaponsGrants(64, 107),
      order: 4
    },
    {
      id: S.featureId(64, 5),
      label: 'Language Limitation',
      description: "understands the languages of its creator but can't speak",
      order: 5
    },
    {
      id: S.featureId(64, 6),
      label: 'Multiattack',
      description: 'The golem makes two slam attacks.',
      attackSlots: {
        alternatives: [
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(64, 7) }] }] }
        ]
      },
      order: 6
    },
    {
      id: S.featureId(64, 7),
      label: 'Slam',
      description:
        'Slam. Melee Weapon Attack: +8 to hit, reach 5 ft., one target. Hit: 16 (2d10 + 5) bludgeoning damage. If the target is a creature, it must succeed on a DC 15 Constitution saving throw or have its hit point maximum reduced by an amount equal to the damage taken. The target dies if this attack reduces its hit point maximum to 0. The reduction lasts until removed by the greater restoration spell or other magic.',
      effects: [
        {
          id: S.actionId(3256, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(3256, 2),
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
              id: S.actionId(3256, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(3256, 3) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(3256, 8),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d10',
                    bonuses: [
                      {
                        id: S.actionId(3256, 9),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.STRENGTH,
                        order: 1
                      }
                    ]
                  },
                  {
                    id: S.actionId(3256, 10),
                    effectKind: S.EFFECT_KIND.FOLLOW_UP_SAVE,
                    timing: 'IMMEDIATE',
                    savingThrow: {
                      id: S.actionId(3256, 11),
                      dcMethod: 'FIXED_DC',
                      abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION,
                      baseDc: 15
                    },
                    attempts: { kind: 'ONCE' },
                    onSuccess: { kind: 'END' },
                    onFailure: {
                      kind: 'OUTCOMES',
                      endCurrent: true,
                      resultKind: 'SINGLE',
                      outcomes: [
                        {
                          id: S.actionId(3256, 12),
                          effectKind: S.EFFECT_KIND.HIT_POINT_MAXIMUM_REDUCTION,
                          amountSource: {
                            kind: 'DAMAGE_TAKEN',
                            damageOutcomeId: S.actionId(3256, 8)
                          },
                          recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM']
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
      order: 7
    },
    {
      id: S.featureId(64, 8),
      ruleDefinitionIds: [S.DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID],
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: S.rechargeFeatureCharge(S.featureId(64, 8)),
      label: 'Haste (Recharge 5-6)',
      description:
        'Haste (Recharge 5-6). Until the end of its next turn, the golem magically gains a +2 bonus to its AC, has advantage on Dexterity saving throws, and can use its slam attack as a bonus action.',
      effects: [
        {
          id: S.actionId(3256, 5),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(3256, 6),
              rangeKind: S.RANGE_KIND.SELF
            },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          paths: [
            {
              id: S.actionId(3256, 7),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(3256, 7) + '__result',
                resultKind: 'SINGLE' as const,
                // Until the end of its next turn: this turn and the one after.
                duration: { id: S.actionId(3256, 10), durationKind: 'TURN', amount: 2 },
                lifecycle: {
                  turnAnchor: { actor: 'TARGET', boundary: 'END_OF_TURN' },
                  // "Can use its slam attack as a bonus action": one more weapon attack a turn, as
                  // Haste's additional action grants (D160).
                  grantedActions: [
                    {
                      activation: S.ACTIVATION_CODE.FREE,
                      usesPerTurn: 1,
                      actionDefinitionIds: [],
                      weaponAttack: true
                    }
                  ]
                },
                outcomes: [
                  {
                    id: S.actionId(3256, 7),
                    effectKind: S.EFFECT_KIND.APPLY_GRANT,
                    grants: {
                      modifiers: [
                        {
                          id: S.actionId(3256, 11),
                          grantKind: S.GRANT_KIND.MODIFIER_GRANT,
                          valueDomainCode: S.VALUE_DOMAIN_CODE.ARMOR_CLASS,
                          domain: {},
                          modifierKind: S.MODIFIER_KIND.BONUS,
                          payload: { valueKind: 'FIXED', amount: 2 },
                          scope: S.MODIFIER_SCOPE_KIND.GLOBAL,
                          selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
                          order: 1
                        },
                        {
                          id: S.actionId(3256, 12),
                          grantKind: S.GRANT_KIND.MODIFIER_GRANT,
                          valueDomainCode: S.VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
                          domain: { ability: S.ABILITY_CODE.DEXTERITY },
                          modifierKind: S.MODIFIER_KIND.ROLL_INFLUENCE,
                          payload: { influence: 'ADVANTAGE' },
                          scope: S.MODIFIER_SCOPE_KIND.GLOBAL,
                          selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
                          order: 2
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
      order: 8
    },
    {
      id: S.featureId(64, 9),
      label: 'Acid Absorption',
      description:
        'Acid Absorption. Whenever the golem is subjected to acid damage, it takes no damage and instead regains a number of hit points equal to the acid damage dealt.',
      order: 9
    }
  ]
}
