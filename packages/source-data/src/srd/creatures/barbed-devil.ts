import { type CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const barbedDevil: CreatureAuthored = {
  id: S.CREATURE_IDS.BARBED_DEVIL,
  label: 'Barbed Devil',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FIEND,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000700000000',
  tags: ['devil'],
  abilityScores: {
    STRENGTH: 16,
    DEXTERITY: 17,
    CONSTITUTION: 18,
    INTELLIGENCE: 12,
    WISDOM: 14,
    CHARISMA: 14
  },
  naturalArmorBonus: 2,
  hitPoints: 110,
  details: [],
  damageVulnerabilities: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 13,
    die: 8,
    modifier: 52
  },
  speeds: [...S.walk(30)],
  proficiencies: [
    S.grantedSkillExpertise(7311, 4, 'PERCEPTION'),
    S.grantedSaveProficiency(7311, 1, 'STRENGTH', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedSkillProficiency(7311, 2, 'DECEPTION', 'INSIGHT'),
    S.grantedLanguageProficiency(7311, 3, 'INFERNAL')
  ],
  damageResistances: [
    "cold; bludgeoning, piercing, and slashing from nonmagical attacks that aren't silvered"
  ],
  damageImmunities: ['fire', 'poison'],
  conditionImmunities: ['poisoned'],
  senses: [S.darkvision(120)],
  passivePerception: 18,
  challengeRatingId: S.CR.CR_5,
  xp: 1800,
  features: [
    {
      id: S.featureId(39, 8),
      label: 'Telepathy',
      description: 'telepathy 120 ft.',
      order: 0
    },
    {
      id: S.featureId(39, 1),
      label: 'Barbed Hide',
      description:
        'Barbed Hide. At the start of each of its turns, the barbed devil deals 5 (1d10) piercing damage to any creature grappling it.',
      order: 1
    },
    {
      id: S.featureId(39, 2),
      label: "Devil's Sight",
      description: "Devil's Sight. Magical darkness doesn't impede the devil's darkvision.",
      order: 2
    },
    {
      id: S.featureId(39, 3),
      label: 'Magic Resistance',
      description:
        'Magic Resistance. The devil has advantage on saving throws against spells and other magical effects.',
      effects: [
        S.closedRuleEffect({
          id: S.actionId(39, 106),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(39, 107), rangeKind: S.RANGE_KIND.SELF }
          },
          ruleKind: S.CLOSED_RULE_KIND.CREATURE_MAGIC_RESISTANCE
        })
      ],
      order: 3
    },
    {
      id: S.featureId(39, 4),
      label: 'Multiattack',
      description:
        'Multiattack. The devil makes three melee attacks: one with its tail and two with its claws. Alternatively, it can use Hurl Flame twice.',
      attackSlots: {
        alternatives: [
          {
            slots: [
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(39, 6) }] },
              { count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(39, 5) }] }
            ]
          },
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(39, 7) }] }] }
        ]
      },
      order: 4
    },
    {
      id: S.featureId(39, 5),
      label: 'Claw',
      description:
        'Claw. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) piercing damage.',
      effects: [
        {
          id: S.actionId(7311, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(7311, 2),
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
              id: S.actionId(7311, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(7311, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(7311, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6',
                    bonuses: [
                      {
                        id: S.actionId(7311, 4),
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
      order: 5
    },
    {
      id: S.featureId(39, 6),
      label: 'Tail',
      description:
        'Tail. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) piercing damage.',
      effects: [
        {
          id: S.actionId(7311, 5),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(7311, 6),
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
              id: S.actionId(7311, 7),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(7311, 7) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(7311, 7),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6',
                    bonuses: [
                      {
                        id: S.actionId(7311, 8),
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
      order: 6
    },
    {
      id: S.featureId(39, 7),
      label: 'Hurl Flame',
      description:
        'Hurl Flame. Ranged Spell Attack: +5 to hit, range 150 ft., one target. Hit: 10 (3d6) fire damage.',
      effects: [
        {
          id: S.actionId(7311, 9),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.RANGED_SPELL_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(7311, 10),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 150,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(7311, 11),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(7311, 11) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(7311, 11),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('FIRE'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '3d6'
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 7
    }
  ]
}
