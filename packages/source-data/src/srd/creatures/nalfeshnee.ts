import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const nalfeshnee: CreatureAuthored = {
  id: S.CREATURE_IDS.NALFESHNEE,
  label: 'Nalfeshnee',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FIEND,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000900000000',
  tags: ['demon'],
  abilityScores: {
    STRENGTH: 21,
    DEXTERITY: 10,
    CONSTITUTION: 22,
    INTELLIGENCE: 19,
    WISDOM: 12,
    CHARISMA: 15
  },
  naturalArmorBonus: 8,
  hitPoints: 184,
  details: [],
  damageVulnerabilities: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 16,
    die: 10,
    modifier: 96
  },
  speeds: [...S.walk(20), ...S.fly(30)],
  proficiencies: [
    S.grantedSaveProficiency(203, 1, 'CONSTITUTION', 'INTELLIGENCE', 'WISDOM', 'CHARISMA'),
    S.grantedLanguageProficiency(203, 2, 'ABYSSAL')
  ],
  damageResistances: [
    'cold, fire, lightning; bludgeoning, piercing, and slashing from nonmagical attacks'
  ],
  damageImmunities: ['poison'],
  conditionImmunities: ['poisoned'],
  senses: [S.truesight(120)],
  passivePerception: 11,
  challengeRatingId: S.CR.CR_13,
  xp: 10000,
  features: [
    {
      id: S.featureId(203, 1),
      label: 'Magic Resistance',
      description:
        'Magic Resistance. The nalfeshnee has advantage on saving throws against spells and other magical effects.',
      grants: S.magicResistanceGrants(203, 501),
      order: 1
    },
    {
      id: S.featureId(203, 2),
      label: 'Telepathy',
      description: 'telepathy 120 ft.',
      order: 2
    },
    {
      id: S.featureId(203, 3),
      label: 'Multiattack',
      description:
        'The nalfeshnee uses Horror Nimbus if it can. It then makes three attacks: one with its bite and two with its claws.',
      attackSlots: {
        alternatives: [
          {
            slots: [
              {
                count: 1,
                fillers: [{ kind: 'FEATURE', featureId: S.featureId(203, 6) }],
                optional: true,
                comesFirst: true
              },
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(203, 4) }] },
              { count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(203, 5) }] }
            ]
          }
        ]
      },
      order: 3
    },
    {
      id: S.featureId(203, 4),
      label: 'Bite',
      description:
        'Melee Weapon Attack: +10 to hit, reach 5 ft., one target. Hit: 32 (5d10 + 5) piercing damage.',
      effects: [
        {
          id: S.actionId(203, 503),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(203, 603),
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
              id: S.actionId(203, 803),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(203, 803) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(203, 930),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '5d10',
                    bonuses: [
                      {
                        id: S.actionId(203, 980),
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
      order: 4
    },
    {
      id: S.featureId(203, 5),
      label: 'Claw',
      description:
        'Melee Weapon Attack: +10 to hit, reach 10 ft., one target. Hit: 15 (3d6 + 5) slashing damage.',
      effects: [
        {
          id: S.actionId(203, 8),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(203, 9),
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
              id: S.actionId(203, 10),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(203, 10) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(203, 10),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '3d6',
                    bonuses: [
                      {
                        id: S.actionId(203, 11),
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
      id: S.featureId(203, 6),
      ruleDefinitionIds: [S.DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID],
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: S.rechargeFeatureCharge(S.featureId(203, 6)),
      label: 'Horror Nimbus (Recharge 5-6)',
      description:
        "Horror Nimbus (Recharge 5-6). The nalfeshnee magically emits scintillating, multicolored light. Each creature within 15 feet of the nalfeshnee that can see the light must succeed on a DC 15 Wisdom saving throw or be frightened for 1 minute. A creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success. If a creature's saving throw is successful or the effect ends for it, the creature is immune to the nalfeshnee's Horror Nimbus for the next 24 hours.",
      effects: [
        S.minuteFearSaveEffect(203, { localIndex: 2000, dc: 15, reach: { radiusFeet: 15 } })
      ],
      order: 6
    },
    {
      id: S.featureId(203, 7),
      label: 'Teleport',
      description:
        'Teleport. The nalfeshnee magically teleports, along with any equipment it is wearing or carrying, up to 120 feet to an unoccupied space it can see.',
      effects: [
        {
          id: S.actionId(203, 15),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(203, 16),
              rangeKind: S.RANGE_KIND.SPECIAL
            }
          },
          paths: [
            {
              id: S.actionId(203, 17),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(203, 17) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(203, 17),
                    effectKind: S.EFFECT_KIND.TELEPORT,
                    targetKind: 'SELF',
                    destinationKind: 'VISIBLE'
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
