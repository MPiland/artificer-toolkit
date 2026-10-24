import { MANIFEST_KIND, SHAPE_KIND, type CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

/** The 5-foot sphere around the pudding that its Corrosive Form covers. */
const corrosiveShape = (offset: number) => ({
  id: S.actionId(47, offset),
  shapeKind: SHAPE_KIND.SPHERE,
  radius: { amount: 5, unit: S.MEASUREMENT_UNIT_CODE.FEET }
})

export const blackPudding: CreatureAuthored = {
  id: S.CREATURE_IDS.BLACK_PUDDING,
  label: 'Black Pudding',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.OOZE,
  size: S.SIZE_CODE.LARGE,
  alignmentId: '00000000-0000-0000-0001-000a00000000',
  abilityScores: {
    STRENGTH: 16,
    DEXTERITY: 5,
    CONSTITUTION: 16,
    INTELLIGENCE: 1,
    WISDOM: 6,
    CHARISMA: 1
  },
  naturalArmorBonus: 0,
  hitPoints: 85,
  details: [],
  proficiencies: [],
  damageVulnerabilities: [],
  damageResistances: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 10,
    die: 10,
    modifier: 30
  },
  speeds: [...S.walk(20), ...S.climb(20)],
  damageImmunities: ['acid', 'cold', 'lightning', 'slashing'],
  conditionImmunities: ['blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'prone'],
  senses: [S.blindsight(60, '(blind beyond this radius)')],
  passivePerception: 8,
  challengeRatingId: S.CR.CR_4,
  xp: 1100,
  features: [
    {
      id: S.featureId(47, 1),
      label: 'Amorphous',
      description:
        'Amorphous. The pudding can move through a space as narrow as 1 inch wide without squeezing.',
      order: 1
    },
    {
      id: S.featureId(47, 2),
      label: 'Corrosive Form',
      description:
        'Corrosive Form. A creature that touches the pudding or hits it with a melee attack while within 5 feet of it takes 4 (1d8) acid damage. Any nonmagical weapon made of metal or wood that hits the pudding corrodes. After dealing damage, the weapon takes a permanent and cumulative -1 penalty to damage rolls. If its penalty drops to -5, the weapon is destroyed. Nonmagical ammunition made of metal or wood that hits the pudding is destroyed after dealing damage. The pudding can eat through 2-inch-thick, nonmagical wood or metal in 1 round.',
      effects: [
        {
          id: S.actionId(47, 103),
          order: 1,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(47, 104), rangeKind: S.RANGE_KIND.SELF },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.AREA_CONTENTS,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            },
            shape: corrosiveShape(111)
          },
          paths: [
            {
              id: S.actionId(47, 105),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${S.actionId(47, 105)}__result`,
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(47, 107),
                    effectKind: S.EFFECT_KIND.MANIFEST,
                    manifestKind: MANIFEST_KIND.ZONE,
                    attachmentKind: 'SOURCE',
                    label: 'Corrosive Form',
                    shape: corrosiveShape(112),
                    components: [
                      {
                        id: S.actionId(47, 113),
                        order: 1,
                        label: 'Acid',
                        interactionKinds: ['MELEE_HIT_ON_SOURCE'],
                        behaviors: [
                          {
                            id: S.actionId(47, 114),
                            order: 1,
                            invocation: {
                              kind: 'PASSIVE',
                              triggerCode: S.TRIGGER.ACTIVATED,
                              range: { id: S.actionId(47, 115), rangeKind: S.RANGE_KIND.SELF }
                            },
                            paths: [
                              {
                                id: S.actionId(47, 116),
                                order: 1,
                                pathCode: S.PATH_CODE.ON_USE,
                                groupType: S.PATH_GROUP_TYPE.SINGLE,
                                originKind: 'SOURCE',
                                selectionKind: 'FIXED',
                                resultBlock: {
                                  id: `${S.actionId(47, 116)}__result`,
                                  resultKind: 'SINGLE',
                                  outcomes: [
                                    {
                                      id: S.actionId(47, 106),
                                      effectKind: S.EFFECT_KIND.DAMAGE,
                                      damageTypeId: S.damageTypeId('ACID'),
                                      valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                      scalingKind: S.SCALING.NONE,
                                      diceConfig: '1d8'
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
        },
        {
          id: S.actionId(47, 117),
          order: 2,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.INCOMING_WEAPON_HIT,
            range: { id: S.actionId(47, 118), rangeKind: S.RANGE_KIND.SELF }
          },
          paths: [
            {
              id: S.actionId(47, 119),
              order: 1,
              pathCode: S.PATH_CODE.PASSIVE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${S.actionId(47, 119)}__result`,
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(47, 120),
                    effectKind: S.EFFECT_KIND.DEGRADE_EQUIPMENT,
                    subject: 'ATTACKER_WEAPON' as const,
                    category: 'WEAPON' as const,
                    nonmagical: true,
                    materials: ['METAL' as const, 'WOOD' as const],
                    step: 1,
                    destroyWhen: { kind: 'PENALTY_REACHES' as const, value: 5 }
                  }
                ]
              }
            }
          ]
        }
      ],
      order: 2
    },
    {
      id: S.featureId(47, 3),
      label: 'Spider Climb',
      description:
        'Spider Climb. The pudding can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.',
      effects: [
        S.manualAdjudicationEffect({
          id: S.actionId(47, 108),
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(47, 109), rangeKind: S.RANGE_KIND.SELF }
          },
          label: 'Spider Climb',
          reasonCode: 'EXTERNAL_WORLD_STATE',
          instructions:
            'The pudding can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.'
        })
      ],
      order: 3
    },
    {
      id: S.featureId(47, 4),
      label: 'Pseudopod',
      description:
        'Pseudopod. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) bludgeoning damage plus 18 (4d8) acid damage. In addition, nonmagical armor worn by the target is partly dissolved and takes a permanent and cumulative -1 penalty to the AC it offers. The armor is destroyed if the penalty reduces its AC to 10.',
      effects: [
        {
          id: S.actionId(5665, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(5665, 2),
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
              id: S.actionId(5665, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(5665, 3) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(5665, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('BLUDGEONING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '1d6',
                    bonuses: [
                      {
                        id: S.actionId(5665, 4),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.STRENGTH,
                        order: 1
                      }
                    ]
                  },
                  {
                    id: S.actionId(47, 110),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('ACID'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '4d8'
                  }
                ]
              }
            },
            {
              id: S.actionId(5665, 5),
              order: 2,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(5665, 5) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(5665, 5),
                    effectKind: S.EFFECT_KIND.DEGRADE_EQUIPMENT,
                    category: 'ARMOR' as const,
                    nonmagical: true,
                    materials: [],
                    step: 1,
                    destroyWhen: { kind: 'ARMOR_CLASS_OFFERED_AT_MOST' as const, value: 10 }
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
      id: S.featureId(47, 5),
      label: 'Split',
      description:
        "Split. When a pudding that is Medium or larger is subjected to lightning or slashing damage, it splits into two new puddings if it has at least 10 hit points. Each new pudding has hit points equal to half the original pudding's, rounded down. New puddings are one size smaller than the original pudding.",
      order: 5
    }
  ]
}
