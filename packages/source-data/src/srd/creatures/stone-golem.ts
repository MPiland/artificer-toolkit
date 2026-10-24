import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { CHANGE_SHAPE_RULING } from './changeShapeRuling.js'
import * as S from './shared.js'
export const stoneGolem: CreatureAuthored = {
  id: S.CREATURE_IDS.STONE_GOLEM,
  label: 'Stone Golem',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.CONSTRUCT,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 22,
    DEXTERITY: 9,
    CONSTITUTION: 20,
    INTELLIGENCE: 3,
    WISDOM: 11,
    CHARISMA: 1
  },
  naturalArmorBonus: 8,
  hitPoints: 178,
  details: [],
  proficiencies: [],
  damageVulnerabilities: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 17,
    die: 10,
    modifier: 85
  },
  speeds: [...S.walk(30)],
  conditionImmunities: [
    'charmed',
    'exhaustion',
    'frightened',
    'paralyzed',
    'petrified',
    'poisoned'
  ],
  damageImmunities: [
    'poison',
    'psychic',
    "bludgeoning, piercing, and slashing from nonmagical attacks that aren't adamantine"
  ],
  senses: [S.darkvision(120)],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_10,
  xp: 5900,
  features: [
    {
      id: S.featureId(265, 1),
      label: 'Immutable Form',
      description:
        'Immutable Form. The golem is immune to any spell or effect that would alter its form.',
      effects: [
        S.manualAdjudicationEffect({
          id: S.actionId(265, 200),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(265, 201), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ...CHANGE_SHAPE_RULING.IMMUTABLE_FORM
        })
      ],
      order: 1
    },
    {
      id: S.featureId(265, 2),
      label: 'Magic Resistance',
      description:
        'Magic Resistance. The golem has advantage on saving throws against spells and other magical effects.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(265, 202),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(265, 203), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_MAGIC_RESISTANCE
        })
      ],
      order: 2
    },
    {
      id: S.featureId(265, 3),
      label: 'Magic Weapons',
      description: 'Magic Weapons. The golem’s weapon attacks are magical.',
      grants: S.magicWeaponsGrants(265, 204),
      order: 3
    },
    {
      id: S.featureId(265, 4),
      label: 'Slow (Recharge 5-6)',
      description:
        "Slow (Recharge 5-6). The golem targets one or more creatures it can see within 10 feet of it. Each target must make a DC 17 Wisdom saving throw against this magic. On a failed save, a target can't use reactions, its speed is halved, and it can't make more than one attack on its turn. In addition, the target can take either an action or a bonus action on its turn, not both. These effects last for 1 minute. A target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success.",
      effects: [
        {
          id: S.actionId(265, 206),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.SAVING_THROW,
            savingThrow: {
              id: S.actionId(265, 207),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM,
              baseDc: 17
            },
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(265, 208),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 10,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.CHOSEN_CREATURES,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(265, 209),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                // A repeat-save result block is an Encounter active effect, so it carries its own UUID.
                id: S.actionId(265, 210),
                resultKind: 'SEQUENCE',
                duration: { id: S.actionId(265, 211), durationKind: 'MINUTE', amount: 1 },
                outcomes: [
                  {
                    // The same action-economy limits as the Slow spell, without its AC and
                    // Dexterity save penalties.
                    id: S.actionId(265, 212),
                    effectKind: S.EFFECT_KIND.APPLY_GRANT,
                    grants: {
                      modifiers: [
                        {
                          id: S.actionId(265, 213),
                          grantKind: S.GRANT_KIND.MODIFIER_GRANT,
                          valueDomainCode: S.VALUE_DOMAIN_CODE.SPEED,
                          domain: {},
                          modifierKind: S.MODIFIER_KIND.MULTIPLY,
                          scope: S.MODIFIER_SCOPE_KIND.GLOBAL,
                          selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
                          payload: { numerator: 1, denominator: 2 },
                          order: 1
                        },
                        {
                          id: S.actionId(265, 214),
                          grantKind: S.GRANT_KIND.MODIFIER_GRANT,
                          valueDomainCode: S.VALUE_DOMAIN_CODE.REACTION_COUNT,
                          domain: {},
                          modifierKind: S.MODIFIER_KIND.SET_VALUE,
                          scope: S.MODIFIER_SCOPE_KIND.GLOBAL,
                          selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
                          payload: { amount: 0 },
                          order: 2
                        },
                        {
                          id: S.actionId(265, 215),
                          grantKind: S.GRANT_KIND.MODIFIER_GRANT,
                          valueDomainCode: S.VALUE_DOMAIN_CODE.ACTION_BONUS_ACTION_EXCLUSIVITY,
                          domain: {},
                          modifierKind: S.MODIFIER_KIND.ENABLE,
                          scope: S.MODIFIER_SCOPE_KIND.GLOBAL,
                          selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
                          order: 3
                        },
                        {
                          id: S.actionId(265, 216),
                          grantKind: S.GRANT_KIND.MODIFIER_GRANT,
                          valueDomainCode: S.VALUE_DOMAIN_CODE.ATTACKS_PER_ATTACK_ACTION,
                          domain: {},
                          modifierKind: S.MODIFIER_KIND.CAP_VALUE,
                          scope: S.MODIFIER_SCOPE_KIND.GLOBAL,
                          selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
                          payload: { amount: 1 },
                          order: 4
                        }
                      ]
                    }
                  },
                  {
                    id: S.actionId(265, 217),
                    effectKind: S.EFFECT_KIND.FOLLOW_UP_SAVE,
                    timing: 'TARGET_TURN_END',
                    savingThrow: {
                      id: S.actionId(265, 218),
                      dcMethod: 'FIXED_DC',
                      abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM,
                      baseDc: 17
                    },
                    attempts: { kind: 'ONCE', repeatOnFailure: true },
                    onSuccess: { kind: 'END' },
                    onFailure: { kind: 'CONTINUE' }
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
      id: S.featureId(265, 5),
      label: 'Slam',
      description:
        'Slam. Melee Weapon Attack: +10 to hit, reach 5 ft., one target. Hit: 19 (3d8 + 6) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(3276, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(3276, 2),
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
              id: S.actionId(3276, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(3276, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(3276, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '3d8+6'
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
      id: S.featureId(265, 6),
      label: 'Multiattack',
      description: 'Multiattack. The golem makes two slam attacks.',
      attackSlots: {
        alternatives: [
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(265, 5) }] }] }
        ]
      },
      order: 6
    }
  ]
}
