import type { CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
import * as R from './rollInfluenceGrants.js'

export const wight: CreatureAuthored = {
  id: S.CREATURE_IDS.WIGHT,
  label: 'Wight',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.UNDEAD,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000800000000',
  abilityScores: {
    STRENGTH: 15,
    DEXTERITY: 14,
    CONSTITUTION: 16,
    INTELLIGENCE: 10,
    WISDOM: 13,
    CHARISMA: 15
  },
  naturalArmorBonus: 0,
  hitPoints: 45,
  details: [],
  damageVulnerabilities: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 6,
    die: 8,
    modifier: 18
  },
  speeds: [...S.walk(30)],
  proficiencies: [S.grantedSkillProficiency(9377, 1, 'PERCEPTION', 'STEALTH')],
  damageResistances: [
    'necrotic',
    "bludgeoning, piercing, and slashing from nonmagical attacks that aren't silvered"
  ],
  damageImmunities: ['poison'],
  conditionImmunities: ['exhaustion', 'poisoned'],
  senses: [S.darkvision(60)],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_3,
  xp: 700,
  features: [
    {
      id: S.featureId(293, 1),
      label: 'Sunlight Sensitivity',
      description:
        'Sunlight Sensitivity. While in sunlight, the wight has disadvantage on attack rolls, as well as on Wisdom (Perception) checks that rely on sight.',
      grants: R.lightSensitivityGrants(293, 100, true),
      order: 1
    },
    {
      id: S.featureId(293, 2),
      label: 'Life Drain',
      description:
        "Life Drain. Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 5 (1d6 + 2) necrotic damage. The target must succeed on a DC 13 Constitution saving throw or its hit point maximum is reduced by an amount equal to the damage taken. This reduction lasts until the target finishes a long rest. The target dies if this effect reduces its hit point maximum to 0. A humanoid slain by this attack rises 24 hours later as a zombie under the wight's control, unless the humanoid is restored to life or its body is destroyed. The wight can have no more than twelve zombies under its control at one time.",
      effects: [
        {
          id: S.actionId(293, 202),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(293, 203),
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
              id: S.actionId(293, 204),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(293, 205),
                resultKind: 'SEQUENCE',
                outcomes: [
                  {
                    id: S.actionId(293, 206),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('NECROTIC'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6+2'
                  },
                  S.lifeDrainSave({
                    id: S.actionId(293, 207),
                    savingThrowId: S.actionId(293, 226),
                    dc: 13,
                    reductionOutcomeId: S.actionId(293, 227),
                    damageOutcomeId: S.actionId(293, 206)
                  })
                ]
              }
            }
          ]
        }
      ],
      order: 2
    },
    {
      id: S.featureId(293, 3),
      label: 'Multiattack',
      description:
        'Multiattack. The wight makes two longsword attacks or two longbow attacks. It can use its Life Drain in place of one longsword attack.',
      attackSlots: {
        alternatives: [
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(293, 4) }] }] },
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(293, 5) }] }] },
          {
            slots: [
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(293, 4) }] },
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(293, 2) }] }
            ]
          }
        ]
      },
      order: 3
    },
    {
      id: S.featureId(293, 4),
      label: 'Longsword',
      description:
        'Longsword. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 6 (1d8 + 2) slashing damage, or 7 (1d10 + 2) slashing damage if used with two hands.',
      effects: [
        {
          id: S.actionId(293, 210),
          order: 1,
          grip: 'ONE_HANDED' as const,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(293, 211),
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
              id: S.actionId(293, 212),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(293, 213),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(293, 214),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d8+2'
                  }
                ]
              }
            }
          ]
        },
        {
          id: S.actionId(293, 221),
          order: 2,
          grip: 'TWO_HANDED' as const,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(293, 222),
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
              id: S.actionId(293, 223),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(293, 224),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(293, 225),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d10+2'
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
      id: S.featureId(293, 5),
      label: 'Longbow',
      description:
        'Longbow. Ranged Weapon Attack: +4 to hit, range 150/600 ft., one target. Hit: 6 (1d8 + 2) piercing damage.',
      effects: [
        {
          id: S.actionId(293, 216),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(293, 217),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 150,
              longAmount: 600,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(293, 218),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: S.actionId(293, 219),
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(293, 220),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('PIERCING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d8+2'
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 5
    }
  ]
}
