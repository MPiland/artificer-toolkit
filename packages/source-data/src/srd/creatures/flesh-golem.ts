import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const fleshGolem: CreatureAuthored = {
  id: S.CREATURE_IDS.FLESH_GOLEM,
  label: 'Flesh Golem',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.CONSTRUCT,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000500000000',
  abilityScores: {
    STRENGTH: 19,
    DEXTERITY: 9,
    CONSTITUTION: 18,
    INTELLIGENCE: 6,
    WISDOM: 10,
    CHARISMA: 5
  },
  naturalArmorBonus: 0,
  hitPoints: 93,
  details: [],
  proficiencies: [],
  damageVulnerabilities: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 11,
    die: 8,
    modifier: 44
  },
  speeds: [...S.walk(30)],
  damageImmunities: [
    "lightning, poison; bludgeoning, piercing, and slashing from nonmagical attacks that aren't adamantine"
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
  passivePerception: 10,
  challengeRatingId: S.CR.CR_5,
  xp: 1800,
  features: [
    {
      id: S.featureId(103, 1),
      label: 'Berserk',
      description:
        "Berserk. Whenever the golem starts its turn with 40 hit points or fewer, roll a d6. On a 6, the golem goes berserk. On each of its turns while berserk, the golem attacks the nearest creature it can see. If no creature is near enough to move to and attack, the golem attacks an object, with preference for an object smaller than itself. Once the golem goes berserk, it continues to do so until it is destroyed or regains all its hit points. The golem's creator, if within 60 feet of the berserk golem, can try to calm it by speaking firmly and persuasively. The golem must be able to hear its creator, who must take an action to make a DC 15 Charisma (Persuasion) check. If the check succeeds, the golem ceases being berserk. If it takes damage while still at 40 hit points or fewer, the golem might go berserk again.",
      order: 1
    },
    {
      id: S.featureId(103, 2),
      label: 'Aversion of Fire',
      description:
        'Aversion of Fire. If the golem takes fire damage, it has disadvantage on attack rolls and ability checks until the end of its next turn.',
      effects: [
        S.incomingDamageGrantEffect(
          S.actionId(103, 202),
          ['FIRE'],
          [
            ...Object.values(S.ATTACK_DOMAIN_CODE).map((attackDomain) => ({
              valueDomainCode: S.VALUE_DOMAIN_CODE.ATTACK_ROLL,
              domain: { attackDomain },
              modifierKind: S.MODIFIER_KIND.ROLL_INFLUENCE,
              payload: { influence: 'DISADVANTAGE' }
            })),
            {
              valueDomainCode: S.VALUE_DOMAIN_CODE.ABILITY_CHECK,
              domain: {},
              modifierKind: S.MODIFIER_KIND.ROLL_INFLUENCE,
              payload: { influence: 'DISADVANTAGE' }
            }
          ]
        )
      ],
      order: 2
    },
    {
      id: S.featureId(103, 3),
      label: 'Immutable Form',
      description:
        'Immutable Form. The golem is immune to any spell or effect that would alter its form.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(103, 203),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(103, 1203), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_IMMUTABLE_FORM
        })
      ],
      order: 3
    },
    {
      id: S.featureId(103, 4),
      label: 'Lightning Absorption',
      description:
        'Lightning Absorption. Whenever the golem is subjected to lightning damage, it takes no damage and instead regains a number of hit points equal to the lightning damage dealt.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(103, 204),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(103, 1204), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_FLESH_GOLEM_LIGHTNING_ABSORPTION
        })
      ],
      order: 4
    },
    {
      id: S.featureId(103, 5),
      label: 'Magic Resistance',
      description:
        'Magic Resistance. The golem has advantage on saving throws against spells and other magical effects.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(103, 205),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.INCOMING_SAVING_THROW,
            range: { id: S.actionId(103, 1205), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_MAGIC_RESISTANCE
        })
      ],
      order: 5
    },
    {
      id: S.featureId(103, 6),
      label: 'Magic Weapons',
      description: "Magic Weapons. The golem's weapon attacks are magical.",
      grants: S.magicWeaponsGrants(103, 206),
      order: 6
    },
    {
      id: S.featureId(103, 7),
      label: 'Language Limitation',
      description: "understands the languages of its creator but can't speak",
      order: 7
    },
    {
      id: S.featureId(103, 8),
      label: 'Multiattack',
      description: 'The golem makes two slam attacks.',
      attackSlots: {
        alternatives: [
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(103, 9) }] }] }
        ]
      },
      order: 8
    },
    {
      id: S.featureId(103, 9),
      label: 'Slam',
      description:
        'Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 13 (2d8 + 4) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(103, 6),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(103, 7),
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
              id: S.actionId(103, 8),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(103, 8) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(103, 8),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d8',
                    bonuses: [
                      {
                        id: S.actionId(103, 9),
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
      order: 9
    }
  ]
}
