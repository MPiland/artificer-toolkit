import { DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared'
import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'
import { conditionTypeId } from '../equipment/shared.js'
import * as S from './shared.js'
import * as R from './rollInfluenceGrants.js'

function weaponAttackOption(input: {
  optionId: number
  effectId: number
  rangeId: number
  pathId: number
  label: string
  order: number
  triggerCode: typeof S.TRIGGER.MELEE_WEAPON_ATTACK | typeof S.TRIGGER.RANGED_WEAPON_ATTACK
  range: number
  /** A ranged attack's long range ("range 30/120 ft."). */
  longRange?: number
  diceConfig: string
  attackBonus: number
}) {
  return {
    id: S.actionId(91, input.optionId),
    label: input.label,
    description: '',
    order: input.order,
    rollDefinitions: [
      {
        id: S.actionId(3450, input.optionId + 1000),
        label: `${input.label} attack`,
        kind: 'ATTACK' as const,
        expression: { count: 1, die: 20, modifier: input.attackBonus },
        rollMode: 'NORMAL' as const,
        chargeCost: null,
        order: 1
      }
    ],
    effects: [
      {
        id: S.actionId(3450, input.effectId),
        order: 1,
        invocation: {
          kind: 'ACTION' as const,
          triggerCode: input.triggerCode,
          activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
          range: {
            id: S.actionId(3450, input.rangeId),
            rangeKind: S.RANGE_KIND.DISTANCE,
            amount: input.range,
            ...(input.longRange === undefined ? {} : { longAmount: input.longRange }),
            unit: S.MEASUREMENT_UNIT_CODE.FEET
          },
          targeting: {
            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
            dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
          }
        },
        paths: [
          {
            id: S.actionId(3450, input.pathId),
            order: 1,
            pathCode: S.PATH_CODE.ON_HIT,
            groupType: S.PATH_GROUP_TYPE.SINGLE,
            originKind: 'SOURCE' as const,
            selectionKind: 'FIXED' as const,
            resultBlock: {
              id: S.actionId(3450, input.pathId) + '__result',
              resultKind: 'SINGLE' as const,
              outcomes: [
                {
                  id: S.actionId(3450, input.pathId),
                  effectKind: S.EFFECT_KIND.DAMAGE,
                  damageTypeId: S.damageTypeId('PIERCING'),
                  valueKind: S.DAMAGE_VALUE_KIND.DICE,
                  scalingKind: S.SCALING.NONE,
                  diceConfig: input.diceConfig
                }
              ]
            }
          }
        ]
      }
    ]
  }
}

export const duergar: CreatureAuthored = {
  id: S.CREATURE_IDS.DUERGAR,
  label: 'Duergar',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.HUMANOID,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000700000000',
  tags: ['dwarf'],
  abilityScores: {
    STRENGTH: 14,
    DEXTERITY: 11,
    CONSTITUTION: 14,
    INTELLIGENCE: 11,
    WISDOM: 10,
    CHARISMA: 9
  },
  naturalArmorBonus: 0,
  hitPoints: 26,
  details: [],
  damageVulnerabilities: [],
  damageImmunities: [],
  qualifiedDamageDefenses: [],
  conditionImmunities: [],
  hitDice: {
    count: 4,
    die: 8,
    modifier: 8
  },
  speeds: [...S.walk(25)],
  proficiencies: [S.grantedLanguageProficiency(3450, 2, 'DWARVISH', 'UNDERCOMMON')],
  damageResistances: ['poison'],
  senses: [S.darkvision(120)],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_1,
  xp: 200,
  features: [
    {
      id: S.featureId(91, 1),
      label: 'Duergar Resilience',
      description:
        'Duergar Resilience. The duergar has advantage on saving throws against poison, spells, and illusions, as well as to resist being charmed or paralyzed.',
      grants: S.advantageGrants(91, 201, {
        savesAgainst: ['POISONED', 'CHARMED', 'PARALYZED'],
        savesAgainstMagic: Object.values(S.ABILITY_CODE)
      }),
      order: 1
    },
    {
      id: S.featureId(91, 2),
      label: 'Sunlight Sensitivity',
      description:
        'Sunlight Sensitivity. While in sunlight, the duergar has disadvantage on attack rolls, as well as on Wisdom (Perception) checks that rely on sight.',
      grants: R.lightSensitivityGrants(91, 100, true),
      order: 2
    },
    {
      id: S.featureId(91, 3),
      label: 'Enlarge (Recharges after a Short or Long Rest)',
      description:
        'Enlarge (Recharges after a Short or Long Rest). For 1 minute, the duergar magically increases in size, along with anything it is wearing or carrying. While enlarged, the duergar is Large, doubles its damage dice on Strength-based weapon attacks (included in the attacks), and makes Strength checks and Strength saving throws with advantage. If the duergar lacks the room to become Large, it attains the maximum size possible in the space available.',
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.actionId(3450, 100),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.SHORT_REST,
        amount: 1
      },
      effects: [
        {
          id: S.actionId(3450, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: {
              code: S.ACTIVATION_CODE.BONUS_ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(3450, 2),
              rangeKind: S.RANGE_KIND.SELF
            },
            resourceUse: { chargeId: S.actionId(3450, 100), cost: 1 }
          },
          paths: [
            {
              id: S.actionId(3450, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(3450, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(3450, 3),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION,
                    label: 'Enlarge',
                    reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
                    instructions:
                      'For 1 minute the duergar and what it wears or carries become Large (or the largest size the space allows), and it makes Strength checks and Strength saving throws with advantage. The doubled Strength weapon damage dice are already in its attacks.'
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
      id: S.featureId(91, 4),
      label: 'War Pick',
      description:
        'War Pick. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 6 (1d8 + 2) piercing damage, or 11 (2d8 + 2) piercing damage while enlarged.',
      options: [
        weaponAttackOption({
          optionId: 404,
          effectId: 4,
          rangeId: 5,
          pathId: 6,
          label: 'War Pick',
          order: 1,
          triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
          range: 5,
          diceConfig: '1d8+2',
          attackBonus: 4
        }),
        weaponAttackOption({
          optionId: 405,
          effectId: 104,
          rangeId: 105,
          pathId: 106,
          label: 'War Pick (Enlarged)',
          order: 2,
          triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
          range: 5,
          diceConfig: '2d8+2',
          attackBonus: 4
        })
      ],
      order: 4
    },
    {
      id: S.featureId(91, 5),
      label: 'Javelin',
      description:
        'Javelin. Melee or Ranged Weapon Attack: +4 to hit, reach 5 ft. or range 30/120 ft., one target. Hit: 5 (1d6 + 2) piercing damage, or 9 (2d6 + 2) piercing damage while enlarged.',
      options: [
        weaponAttackOption({
          optionId: 406,
          effectId: 7,
          rangeId: 8,
          pathId: 9,
          label: 'Javelin (Melee)',
          order: 1,
          triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
          range: 5,
          diceConfig: '1d6+2',
          attackBonus: 4
        }),
        weaponAttackOption({
          optionId: 407,
          effectId: 10,
          rangeId: 11,
          pathId: 12,
          label: 'Javelin (Ranged)',
          order: 2,
          triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
          range: 30,
          longRange: 120,
          diceConfig: '1d6+2',
          attackBonus: 4
        }),
        weaponAttackOption({
          optionId: 408,
          effectId: 107,
          rangeId: 108,
          pathId: 109,
          label: 'Javelin (Melee, Enlarged)',
          order: 3,
          triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
          range: 5,
          diceConfig: '2d6+2',
          attackBonus: 4
        }),
        weaponAttackOption({
          optionId: 409,
          effectId: 110,
          rangeId: 111,
          pathId: 112,
          label: 'Javelin (Ranged, Enlarged)',
          order: 4,
          triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
          range: 30,
          longRange: 120,
          diceConfig: '2d6+2',
          attackBonus: 4
        })
      ],
      order: 5
    },
    {
      id: S.featureId(91, 6),
      label: 'Invisibility (Recharges after a Short or Long Rest)',
      description:
        'Invisibility (Recharges after a Short or Long Rest). The duergar magically turns invisible until it attacks, casts a spell, or uses its Enlarge, or until its concentration is broken, up to 1 hour (as if concentrating on a spell). Any equipment the duergar wears or carries is invisible with it.',
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.actionId(3450, 101),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.SHORT_REST,
        amount: 1
      },
      effects: [
        {
          id: S.actionId(3450, 13),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(3450, 14),
              rangeKind: S.RANGE_KIND.SELF
            },
            resourceUse: { chargeId: S.actionId(3450, 101), cost: 1 }
          },
          paths: [
            {
              id: S.actionId(3450, 15),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(3450, 15) + '__result',
                resultKind: 'SINGLE' as const,
                duration: {
                  id: S.actionId(3450, 16),
                  durationKind: DURATION_KIND.HOUR,
                  amount: 1
                },
                lifecycle: {
                  endOnEvents: ['ON_ATTACK_ROLL', 'ON_CAST_SPELL']
                },
                outcomes: [
                  {
                    id: S.actionId(3450, 15),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('INVISIBLE')
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 6
    }
  ]
}
