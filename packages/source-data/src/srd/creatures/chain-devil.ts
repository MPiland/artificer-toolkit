import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import {
  DURATION_KIND,
  MANIFEST_KIND,
  NUMERIC_EXPR_CODE,
  SHAPE_KIND,
  type CreatureAuthored
} from '@artificer-toolkit/shared'
import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'
import { conditionTypeId } from '../equipment/shared.js'

import * as S from './shared.js'

/** The 30-foot sphere around the devil that its Unnerving Mask covers. */
const unnervingMaskShape = (offset: number) => ({
  id: S.actionId(61, offset),
  shapeKind: SHAPE_KIND.SPHERE,
  radius: { amount: 30, unit: S.MEASUREMENT_UNIT_CODE.FEET }
})

export const chainDevil: CreatureAuthored = {
  id: S.CREATURE_IDS.CHAIN_DEVIL,
  label: 'Chain Devil',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FIEND,
  size: S.SIZE_CODE.MEDIUM,
  alignmentId: '00000000-0000-0000-0001-000700000000',
  tags: ['devil'],
  abilityScores: {
    STRENGTH: 18,
    DEXTERITY: 15,
    CONSTITUTION: 18,
    INTELLIGENCE: 11,
    WISDOM: 12,
    CHARISMA: 14
  },
  naturalArmorBonus: 4,
  hitPoints: 85,
  details: [],
  damageVulnerabilities: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 10,
    die: 8,
    modifier: 40
  },
  speeds: [...S.walk(30)],
  proficiencies: [
    S.grantedSaveProficiency(61, 1, 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedLanguageProficiency(61, 2, 'INFERNAL')
  ],
  damageResistances: [
    "cold; bludgeoning, piercing, and slashing from nonmagical attacks that aren't silvered"
  ],
  damageImmunities: ['fire', 'poison'],
  conditionImmunities: ['poisoned'],
  senses: [S.darkvision(120)],
  passivePerception: 11,
  challengeRatingId: S.CR.CR_8,
  xp: 3900,
  features: [
    {
      id: S.featureId(61, 1),
      label: "Devil's Sight",
      description: "Devil's Sight. Magical darkness doesn't impede the devil's darkvision.",
      order: 1
    },
    {
      id: S.featureId(61, 2),
      label: 'Magic Resistance',
      description:
        'Magic Resistance. The devil has advantage on saving throws against spells and other magical effects.',
      grants: S.magicResistanceGrants(61, 101),
      order: 2
    },
    {
      id: S.featureId(61, 3),
      label: 'Telepathy',
      description: 'telepathy 120 ft.',
      order: 3
    },
    {
      id: S.featureId(61, 4),
      label: 'Multiattack',
      description: 'Multiattack. The devil makes two attacks with its chains.',
      attackSlots: {
        alternatives: [
          { slots: [{ count: 2, fillers: [{ kind: 'FEATURE', featureId: S.featureId(61, 5) }] }] }
        ]
      },
      order: 4
    },
    {
      id: S.featureId(61, 5),
      label: 'Chain',
      description:
        "Chain. Melee Weapon Attack: +8 to hit, reach 10 ft., one target. Hit: 11 (2d6 + 4) slashing damage. The target is grappled (escape DC 14) if the devil isn't already grappling a creature. Until this grapple ends, the target is restrained and takes 7 (2d6) piercing damage at the start of each of its turns.",
      effects: [
        {
          id: S.actionId(61, 105),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(61, 106),
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
              id: S.actionId(61, 107),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${S.actionId(61, 107)}__result`,
                resultKind: 'SEQUENCE',
                outcomes: [
                  {
                    id: S.actionId(61, 108),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6',
                    bonuses: [
                      {
                        id: S.actionId(61, 109),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.STRENGTH,
                        order: 1
                      }
                    ]
                  },
                  S.grappledOutcome(61, {
                    localIndex: 1,
                    escapeDc: 14,
                    heldAtOnce: 1,
                    untilEnds: ['RESTRAINED'],
                    recurrence: {
                      turnAnchor: { actor: 'TARGET', boundary: 'START_OF_TURN' },
                      outcome: {
                        id: S.actionId(61, 112),
                        effectKind: S.EFFECT_KIND.DAMAGE,
                        damageTypeId: S.damageTypeId('PIERCING'),
                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                        scalingKind: S.SCALING.NONE,
                        diceConfig: '2d6'
                      }
                    }
                  })
                ]
              }
            }
          ]
        }
      ],
      order: 5
    },
    {
      id: S.featureId(61, 6),
      label: 'Animate Chains (Recharges after a Short or Long Rest)',
      description:
        "Up to four chains the devil can see within 60 feet of it magically sprout razor-edged barbs and animate under the devil's control, provided that the chains aren't being worn or carried. Each animated chain is an object with AC 20, 20 hit points, resistance to piercing damage, and immunity to psychic and thunder damage. When the devil uses Multiattack on its turn, it can use each animated chain to make one additional chain attack. An animated chain can grapple one creature of its own but can't make attacks while grappling. An animated chain reverts to its inanimate state if reduced to 0 hit points or if the devil is incapacitated or dies.",
      attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: S.actionId(61, 12),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: S.SCALING.NONE,
        resetKind: S.CHARGE_RESET_KIND.SHORT_REST,
        amount: 1
      },
      effects: [
        {
          id: S.actionId(61, 113),
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: S.actionId(61, 114),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 60,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            resourceUse: { chargeId: S.actionId(61, 12), cost: 1 }
          },
          paths: [
            {
              id: S.actionId(61, 115),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${S.actionId(61, 115)}__result`,
                resultKind: 'SEQUENCE',
                outcomes: [
                  {
                    id: S.actionId(61, 116),
                    effectKind: S.EFFECT_KIND.MANIFEST,
                    manifestKind: MANIFEST_KIND.SUMMON,
                    label: 'Animated Chain',
                    statBlock: {
                      // The SRD names no size; a chain is drawn in one 5-foot square.
                      size: S.SIZE_CODE.MEDIUM,
                      armorClass: { kind: NUMERIC_EXPR_CODE.FIXED, value: 20 },
                      hitPoints: { kind: NUMERIC_EXPR_CODE.FIXED, value: 20 },
                      damageResistances: [S.damageTypeId('PIERCING')],
                      damageImmunities: [S.damageTypeId('PSYCHIC'), S.damageTypeId('THUNDER')]
                    }
                  },
                  {
                    id: S.actionId(61, 121),
                    effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION,
                    label: 'Animate Chains',
                    reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
                    instructions:
                      'Up to four chains that aren’t worn or carried animate; each is an Animated Chain under the devil’s control. When the devil uses Multiattack, each chain makes one additional chain attack. A chain can grapple one creature of its own but can’t attack while grappling. A chain reverts to an inanimate object at 0 hit points or when the devil is incapacitated or dies; the GM then removes it.'
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
      id: S.featureId(61, 7),
      label: 'Unnerving Mask',
      description:
        "When a creature the devil can see starts its turn within 30 feet of the devil, the devil can create the illusion that it looks like one of the creature's departed loved ones or bitter enemies. If the creature can see the devil, it must succeed on a DC 14 Wisdom saving throw or be frightened until the end of its turn.",
      effects: [
        {
          id: S.actionId(61, 122),
          order: 1,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(61, 124), rangeKind: S.RANGE_KIND.SELF },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.AREA_CONTENTS,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            },
            shape: unnervingMaskShape(128)
          },
          paths: [
            {
              id: S.actionId(61, 125),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${S.actionId(61, 125)}__result`,
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(61, 127),
                    effectKind: S.EFFECT_KIND.MANIFEST,
                    manifestKind: MANIFEST_KIND.ZONE,
                    attachmentKind: 'SOURCE',
                    label: 'Unnerving Mask',
                    shape: unnervingMaskShape(129),
                    components: [
                      {
                        id: S.actionId(61, 130),
                        order: 1,
                        label: 'A creature starts its turn in view',
                        interactionKinds: ['START_TURN_IN_SPACE'],
                        requiredSight: ['OCCUPANT_SEES_SOURCE', 'SOURCE_SEES_OCCUPANT'],
                        behaviors: [
                          {
                            id: S.actionId(61, 131),
                            order: 1,
                            invocation: {
                              kind: 'PASSIVE',
                              triggerCode: S.TRIGGER.SAVING_THROW,
                              savingThrow: {
                                id: S.actionId(61, 123),
                                dcMethod: 'FIXED_DC',
                                abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM,
                                baseDc: 14
                              },
                              range: { id: S.actionId(61, 132), rangeKind: S.RANGE_KIND.SELF }
                            },
                            paths: [
                              {
                                id: S.actionId(61, 133),
                                order: 1,
                                pathCode: S.PATH_CODE.ON_SAVE_FAIL,
                                groupType: S.PATH_GROUP_TYPE.SINGLE,
                                originKind: 'SOURCE',
                                selectionKind: 'FIXED',
                                resultBlock: {
                                  id: `${S.actionId(61, 133)}__result`,
                                  resultKind: 'SINGLE',
                                  duration: {
                                    id: S.actionId(61, 134),
                                    durationKind: DURATION_KIND.ROUND,
                                    amount: 1
                                  },
                                  // "Until the end of its turn."
                                  lifecycle: {
                                    turnAnchor: { actor: 'TARGET', boundary: 'END_OF_TURN' }
                                  },
                                  outcomes: [
                                    {
                                      id: S.actionId(61, 126),
                                      effectKind: S.EFFECT_KIND.CONDITION,
                                      conditionId: conditionTypeId('FRIGHTENED'),
                                      recordsSource: true
                                    }
                                  ]
                                }
                              }
                            ]
                          }
                        ]
                      }
                    ]
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
