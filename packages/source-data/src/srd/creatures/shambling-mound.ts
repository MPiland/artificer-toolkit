import type { CreatureAuthored } from '@artificer-toolkit/shared'
import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'
import * as S from './shared.js'
export const shamblingMound: CreatureAuthored = {
  id: S.CREATURE_IDS.SHAMBLING_MOUND,
  label: 'Shambling Mound',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.PLANT,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 8,
    CONSTITUTION: 16,
    INTELLIGENCE: 5,
    WISDOM: 10,
    CHARISMA: 5
  },
  naturalArmorBonus: 6,
  hitPoints: 136,
  details: [],
  damageVulnerabilities: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 16,
    die: 10,
    modifier: 48
  },
  speeds: [...S.walk(20), ...S.swim(20)],
  proficiencies: [S.grantedSkillProficiency(251, 1, 'STEALTH')],
  conditionImmunities: ['blinded', 'deafened', 'exhaustion'],
  senses: [S.blindsight(60, '(blind beyond this radius)')],
  damageResistances: ['cold', 'fire'],
  damageImmunities: ['lightning'],
  passivePerception: 10,
  challengeRatingId: S.CR.CR_5,
  xp: 1800,
  features: [
    {
      id: S.featureId(251, 2),
      label: 'Lightning Absorption',
      description:
        'Lightning Absorption. Whenever the shambling mound is subjected to lightning damage, it takes no damage and regains a number of hit points equal to the lightning damage dealt.',
      effects: [
        S.manualAdjudicationEffect({
          id: S.actionId(251, 501),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(251, 601), rangeKind: S.RANGE_KIND.SELF },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          label: 'Lightning Absorption',
          reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
          instructions:
            'Whenever the shambling mound is subjected to lightning damage, it takes no damage and instead regains hit points equal to the lightning damage that would have been dealt.'
        })
      ],
      order: 2
    },
    {
      id: S.featureId(251, 3),
      label: 'Engulf',
      description:
        "Engulf. The shambling mound engulfs a Medium or smaller creature grappled by it. The engulfed target is blinded, restrained, and unable to breathe, and it must succeed on a DC 14 Constitution saving throw at the start of each of the mound's turns or take 13 (2d8 + 4) bludgeoning damage. If the mound moves, the engulfed target moves with it. The mound can have only one creature engulfed at a time.",
      effects: [
        {
          id: S.actionId(251, 502),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(251, 602),
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
              id: S.actionId(251, 802),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(251, 802) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  // Layered on the Slam's grapple: the engulfed target is held by the same source, one at a time.
                  S.grappledOutcome(251, {
                    localIndex: 10,
                    escapeDc: 14,
                    heldAtOnce: 1,
                    largestTarget: S.SIZE_CODE.MEDIUM,
                    omitGrappled: true,
                    untilEnds: ['BLINDED', 'RESTRAINED'],
                    // "at the start of each of the mound's turns": counted on the holder's turns.
                    recurrence: {
                      turnAnchor: { actor: 'SOURCE', boundary: 'START_OF_TURN' },
                      savingThrow: {
                        id: S.actionId(251, 902),
                        dcMethod: 'FIXED_DC',
                        abilityDefinitionId: S.SRD_ABILITY_DEFINITION_IDS.CONSTITUTION,
                        baseDc: 14
                      },
                      outcome: {
                        id: S.actionId(251, 903),
                        effectKind: S.EFFECT_KIND.DAMAGE,
                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                        scalingKind: S.SCALING.NONE,
                        diceConfig: '2d8+4'
                      }
                    }
                  })
                ]
              }
            }
          ]
        }
      ],
      order: 3
    },
    {
      id: S.featureId(251, 4),
      label: 'Slam',
      description:
        'Slam. Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 13 (2d8 + 4) bludgeoning damage.',
      effects: [
        {
          id: S.actionId(4581, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(4581, 2),
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
              id: S.actionId(4581, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(4581, 3) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(4581, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d8+4'
                  },
                  // "If both attacks hit a Medium or smaller target, the target is grappled": the print's
                  // rule rides the Slam, gated on the open Attack action (D93).
                  S.grappledOutcome(251, {
                    localIndex: 1,
                    escapeDc: 14,
                    heldAtOnce: 1,
                    largestTarget: S.SIZE_CODE.MEDIUM,
                    appliesWhen: { kind: 'EARLIER_SLOTS_HIT_SAME_TARGET' }
                  })
                ]
              }
            }
          ]
        }
      ],
      order: 4
    },
    {
      id: S.featureId(251, 5),
      label: 'Multiattack',
      description:
        'Multiattack. The shambling mound makes two slam attacks. If both attacks hit a Medium or smaller target, the target is grappled (escape DC 14), and the shambling mound uses its Engulf on it.',
      attackSlots: {
        alternatives: [
          {
            slots: [
              { count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(251, 4) }] },
              {
                count: 1,
                fillers: [{ kind: 'FEATURE', featureId: S.featureId(251, 3) }],
                optional: true,
                condition: { kind: 'EARLIER_SLOTS_HIT_SAME_TARGET' }
              }
            ]
          }
        ]
      },
      order: 5
    }
  ]
}
