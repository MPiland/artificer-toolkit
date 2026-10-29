import {
  ATTACK_DOMAIN_CODE,
  DURATION_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  ROLLED_DIE_SIGN,
  VALUE_DOMAIN_CODE,
  type CreatureAuthored
} from '@artificer-toolkit/shared'
import { CR, CREATURE_IDS, CREATURE_TYPE, SRD_SYSTEM_ID, SRD_USER_ID, walk } from './shared.js'
import * as S from './shared.js'

export const knight: CreatureAuthored = {
  id: CREATURE_IDS.KNIGHT,
  label: 'Knight',
  description: 'Medium humanoid (any race), any alignment',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'NPC',
  creatureTypeId: CREATURE_TYPE.HUMANOID,
  size: 'MEDIUM',
  tags: ['any race'],
  abilityScores: {
    STRENGTH: 16,
    DEXTERITY: 11,
    CONSTITUTION: 14,
    INTELLIGENCE: 11,
    WISDOM: 11,
    CHARISMA: 15
  },
  naturalArmorBonus: 0,
  hitPoints: 52,
  details: [],
  senses: [],
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 8,
    die: 8,
    modifier: 16
  },
  speeds: walk(30),
  proficiencies: [S.grantedSaveProficiency(178, 1, 'CONSTITUTION', 'WISDOM')],
  passivePerception: 10,
  challengeRatingId: CR.CR_3,
  xp: 700,
  features: [
    {
      id: S.featureId(178, 7),
      label: 'Language Knowledge',
      description: 'any one language (usually Common)',
      grants: {
        proficiencies: [S.grantedLanguageProficiency(178, 2, 'COMMON')]
      },
      order: 0
    },
    {
      id: S.featureId(178, 1),
      label: 'Brave',
      description: 'Brave. The knight has advantage on saving throws against being frightened.',
      grants: S.advantageGrants(178, 1, { savesAgainst: ['FRIGHTENED'] }),
      order: 1
    },
    {
      id: S.featureId(178, 2),
      label: 'Multiattack',
      description: 'Multiattack. The knight makes two melee attacks.',
      attackSlots: {
        alternatives: [
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(178, 3) }] }] }
        ]
      },
      order: 2
    },
    {
      id: S.featureId(178, 3),
      label: 'Greatsword',
      description:
        'Greatsword. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) slashing damage.',
      effects: [
        {
          id: S.actionId(178, 503),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(178, 603),
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
              id: S.actionId(178, 803),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(178, 803) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(178, 930),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6',
                    bonuses: [
                      {
                        id: S.actionId(178, 980),
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
      order: 3
    },
    {
      id: S.featureId(178, 4),
      label: 'Heavy Crossbow',
      description:
        'Heavy Crossbow. Ranged Weapon Attack: +2 to hit, range 100/400 ft., one target. Hit: 5 (1d10) piercing damage.',
      effects: [
        {
          id: S.actionId(178, 504),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(178, 604),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 100,
              longAmount: 400,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(178, 804),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(178, 804) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(178, 940),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d10'
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
      id: S.featureId(178, 5),
      label: 'Leadership (Recharges after a Short or Long Rest)',
      description:
        'Leadership (Recharges after a Short or Long Rest). For 1 minute, the knight can utter a special command or warning whenever a nonhostile creature that it can see within 30 feet of it makes an attack roll or a saving throw. The creature can add a d4 to its roll provided it can hear and understand the knight. A creature can benefit from only one Leadership die at a time. This effect ends if the knight is incapacitated.',
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.actionId(178, 605),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.SHORT_REST,
        amount: 1
      },
      effects: [
        {
          id: S.actionId(178, 505),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(178, 606),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 30,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.CHOSEN_CREATURES,
              dispositionKind: S.TARGET_DISPOSITION_KIND.WILLING
            },
            resourceUse: { chargeId: S.actionId(178, 605), cost: 1 }
          },
          paths: [
            {
              id: S.actionId(178, 607),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(178, 608),
                resultKind: 'SINGLE' as const,
                duration: {
                  id: S.actionId(178, 609),
                  durationKind: DURATION_KIND.MINUTE,
                  amount: 1
                },
                lifecycle: {
                  endTriggers: [{ event: 'INCAPACITATED' as const, of: 'SOURCE' as const }]
                },
                outcomes: [
                  {
                    id: S.actionId(178, 615),
                    effectKind: S.EFFECT_KIND.APPLY_GRANT,
                    grants: {
                      modifiers: [
                        {
                          id: S.actionId(178, 610),
                          grantKind: S.GRANT_KIND.MODIFIER_GRANT,
                          valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
                          domain: { attackDomain: ATTACK_DOMAIN_CODE.MELEE },
                          modifierKind: MODIFIER_KIND.ADD_BONUS_DIE,
                          scope: MODIFIER_SCOPE_KIND.GLOBAL,
                          selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
                          payload: { count: 1, faces: 4, sign: ROLLED_DIE_SIGN.ADD },
                          order: 1
                        },
                        {
                          id: S.actionId(178, 611),
                          grantKind: S.GRANT_KIND.MODIFIER_GRANT,
                          valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
                          domain: { attackDomain: ATTACK_DOMAIN_CODE.RANGED },
                          modifierKind: MODIFIER_KIND.ADD_BONUS_DIE,
                          scope: MODIFIER_SCOPE_KIND.GLOBAL,
                          selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
                          payload: { count: 1, faces: 4, sign: ROLLED_DIE_SIGN.ADD },
                          order: 2
                        },
                        {
                          id: S.actionId(178, 612),
                          grantKind: S.GRANT_KIND.MODIFIER_GRANT,
                          valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
                          domain: { attackDomain: ATTACK_DOMAIN_CODE.SPELL },
                          modifierKind: MODIFIER_KIND.ADD_BONUS_DIE,
                          scope: MODIFIER_SCOPE_KIND.GLOBAL,
                          selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
                          payload: { count: 1, faces: 4, sign: ROLLED_DIE_SIGN.ADD },
                          order: 3
                        },
                        {
                          id: S.actionId(178, 613),
                          grantKind: S.GRANT_KIND.MODIFIER_GRANT,
                          valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
                          domain: { attackDomain: ATTACK_DOMAIN_CODE.UNARMED },
                          modifierKind: MODIFIER_KIND.ADD_BONUS_DIE,
                          scope: MODIFIER_SCOPE_KIND.GLOBAL,
                          selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
                          payload: { count: 1, faces: 4, sign: ROLLED_DIE_SIGN.ADD },
                          order: 4
                        },
                        {
                          id: S.actionId(178, 614),
                          grantKind: S.GRANT_KIND.MODIFIER_GRANT,
                          valueDomainCode: VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
                          domain: {},
                          modifierKind: MODIFIER_KIND.ADD_BONUS_DIE,
                          scope: MODIFIER_SCOPE_KIND.GLOBAL,
                          selectionKind: S.AUTHORING_SELECTION_KIND.GRANTED,
                          payload: { count: 1, faces: 4, sign: ROLLED_DIE_SIGN.ADD },
                          order: 5
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
      order: 5
    },
    {
      id: S.featureId(178, 6),
      label: 'Parry',
      description:
        'Parry. The knight adds 2 to its AC against one melee attack that would hit it. To do so, the knight must see the attacker and be wielding a melee weapon.',
      effects: [S.parryReaction(178, 501, 2)],
      order: 6
    }
  ]
}
