import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { conditionTypeId } from '../equipment/shared.js'
import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'
import * as S from './shared.js'

export const mummy: CreatureAuthored = {
  id: S.CREATURE_IDS.MUMMY,
  label: 'Mummy',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.UNDEAD,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000700000000',
  abilityScores: {
    STRENGTH: 16,
    DEXTERITY: 8,
    CONSTITUTION: 15,
    INTELLIGENCE: 6,
    WISDOM: 10,
    CHARISMA: 12
  },
  naturalArmorBonus: 2,
  hitPoints: 58,
  details: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 9,
    die: 8,
    modifier: 18
  },
  speeds: [...S.walk(20)],
  proficiencies: [S.grantedSaveProficiency(2585, 1, 'WISDOM')],
  damageVulnerabilities: ['fire'],
  damageResistances: ['bludgeoning, piercing, and slashing from nonmagical attacks'],
  damageImmunities: ['necrotic', 'poison'],
  conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'paralyzed', 'poisoned'],
  senses: [S.darkvision(60)],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_3,
  xp: 700,
  features: [
    {
      id: S.featureId(201, 1),
      label: 'Language Limitation',
      description: 'understands the languages it knew in life',
      order: 1
    },
    {
      id: S.featureId(201, 2),
      label: 'Multiattack',
      description:
        'Multiattack. The mummy can use its Dreadful Glare and makes one attack with its rotting fist.',
      attackSlots: {
        alternatives: [
          {
            slots: [
              {
                count: 1,
                fillers: [{ kind: 'FEATURE', featureId: S.featureId(201, 4) }],
                optional: true,
                comesFirst: true
              },
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(201, 3) }] }
            ]
          }
        ]
      },
      order: 2
    },
    {
      id: S.featureId(201, 3),
      label: 'Rotting Fist',
      description:
        "Rotting Fist. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) bludgeoning damage plus 10 (3d6) necrotic damage. If the target is a creature, it must succeed on a DC 12 Constitution saving throw or be cursed with mummy rot. The cursed target can't regain hit points, and its hit point maximum decreases by 10 (3d6) for every 24 hours that elapse. If the curse reduces the target's hit point maximum to 0, the target dies, and its body turns to dust. The curse lasts until removed by the remove curse spell or other magic.",
      effects: [
        {
          id: S.actionId(201, 502),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(201, 602),
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
              id: S.actionId(201, 802),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(201, 802) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(201, 920),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6',
                    bonuses: [
                      {
                        id: S.actionId(201, 970),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.STRENGTH,
                        order: 1
                      }
                    ]
                  },
                  {
                    id: S.actionId(201, 921),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('NECROTIC'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '3d6'
                  },
                  {
                    id: S.actionId(201, 928),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION,
                    label: 'Mummy Rot',
                    instructions:
                      "If the target is a creature, it must succeed on a DC 12 Constitution saving throw or be cursed with mummy rot. The cursed target can't regain hit points, and its hit point maximum decreases by 10 (3d6) for every 24 hours that elapse. If the curse reduces the target's hit point maximum to 0, the target dies, and its body turns to dust. The curse lasts until removed by the remove curse spell or other magic.",
                    reasonCode: MANUAL_ADJUDICATION_REASON.NARRATIVE_JUDGMENT
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
      id: S.featureId(201, 4),
      label: 'Dreadful Glare',
      description:
        "Dreadful Glare. The mummy targets one creature it can see within 60 feet of it. If the target can see the mummy, it must succeed on a DC 11 Wisdom saving throw against this magic or become frightened until the end of the mummy's next turn. If the target fails the saving throw by 5 or more, it is also paralyzed for the same duration. A target that succeeds on the saving throw is immune to the Dreadful Glare of all mummies (but not mummy lords) for the next 24 hours.",
      effects: [
        {
          id: S.actionId(201, 503),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.SAVING_THROW,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            savingThrow: {
              id: S.actionId(201, 603),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM,
              baseDc: 11
            },
            range: {
              id: S.actionId(201, 604),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 60,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(201, 803),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(201, 803) + '__result',
                resultKind: 'SINGLE' as const,
                // Until the end of the mummy's next turn: one round counted on the source's turns.
                duration: {
                  id: S.actionId(201, 940),
                  durationKind: 'ROUND' as const,
                  amount: 1
                },
                lifecycle: { turnAnchor: { actor: 'SOURCE', boundary: 'END_OF_TURN' } },
                // Failing by 5 or more also paralyzes it for the same duration.
                failureMarginRider: {
                  id: S.actionId(201, 941),
                  failedBy: 5,
                  outcomes: [
                    {
                      id: S.actionId(201, 942),
                      effectKind: S.EFFECT_KIND.CONDITION,
                      conditionId: conditionTypeId('PARALYZED')
                    }
                  ],
                  lifecycle: {}
                },
                outcomes: [
                  {
                    id: S.actionId(201, 930),
                    effectKind: S.EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('FRIGHTENED'),
                    recordsSource: true
                  }
                ]
              }
            },
            S.saveImmunityPath(201, 945)
          ]
        }
      ],
      order: 4
    }
  ]
}
