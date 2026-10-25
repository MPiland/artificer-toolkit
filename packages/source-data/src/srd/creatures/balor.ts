import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import { MANIFEST_KIND, SHAPE_KIND, type CreatureAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

/** The 5-foot sphere around the balor that its Fire Aura covers. */
const fireAuraShape = (offset: number) => ({
  id: S.actionId(36, offset),
  shapeKind: SHAPE_KIND.SPHERE,
  radius: { amount: 5, unit: S.MEASUREMENT_UNIT_CODE.FEET }
})

export const balor: CreatureAuthored = {
  id: S.CREATURE_IDS.BALOR,
  label: 'Balor',
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  category: S.CREATURE_CATEGORY_CODE.MONSTER,
  creatureTypeId: S.CREATURE_TYPE.FIEND,
  size: S.SIZE_CODE.HUGE,
  alignmentId: '00000000-0000-0000-0001-000900000000',
  tags: ['demon'],
  abilityScores: {
    STRENGTH: 26,
    DEXTERITY: 15,
    CONSTITUTION: 22,
    INTELLIGENCE: 20,
    WISDOM: 16,
    CHARISMA: 22
  },
  naturalArmorBonus: 7,
  hitPoints: 262,
  details: [],
  damageVulnerabilities: [],
  qualifiedDamageDefenses: [],
  hitDice: {
    count: 21,
    die: 12,
    modifier: 126
  },
  speeds: [...S.walk(40), ...S.fly(80)],
  proficiencies: [
    S.grantedSaveProficiency(2128, 1, 'STRENGTH', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
    S.grantedLanguageProficiency(2128, 3, 'ABYSSAL')
  ],
  damageResistances: [
    'cold',
    'lightning',
    'bludgeoning, piercing, and slashing from nonmagical attacks'
  ],
  damageImmunities: ['fire', 'poison'],
  conditionImmunities: ['poisoned'],
  senses: [S.truesight(120)],
  passivePerception: 13,
  challengeRatingId: S.CR.CR_19,
  xp: 22000,
  features: [
    {
      id: S.featureId(36, 1),
      label: 'Magic Resistance',
      description:
        'Magic Resistance. The balor has advantage on saving throws against spells and other magical effects.',
      grants: S.magicResistanceGrants(36, 101),
      order: 1
    },
    {
      id: S.featureId(36, 2),
      label: 'Fire Aura',
      description:
        "Fire Aura. At the start of each of the balor's turns, each creature within 5 feet of it takes 10 (3d6) fire damage, and flammable objects in the aura that aren't being worn or carried ignite. A creature that touches the balor or hits it with a melee attack while within 5 feet of it takes 10 (3d6) fire damage.",
      effects: [
        {
          id: S.actionId(36, 103),
          order: 1,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.ACTIVATED,
            range: { id: S.actionId(36, 104), rangeKind: S.RANGE_KIND.SELF },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.AREA_CONTENTS,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            },
            shape: fireAuraShape(124)
          },
          paths: [
            {
              id: S.actionId(36, 105),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${S.actionId(36, 105)}__result`,
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(36, 107),
                    effectKind: S.EFFECT_KIND.MANIFEST,
                    manifestKind: MANIFEST_KIND.ZONE,
                    attachmentKind: 'SOURCE',
                    label: 'Fire Aura',
                    shape: fireAuraShape(125),
                    components: [
                      {
                        id: S.actionId(36, 126),
                        order: 1,
                        label: 'Searing heat',
                        interactionKinds: ['START_OF_SOURCE_TURN', 'MELEE_HIT_ON_SOURCE'],
                        behaviors: [
                          {
                            id: S.actionId(36, 127),
                            order: 1,
                            invocation: {
                              kind: 'PASSIVE',
                              triggerCode: S.TRIGGER.ACTIVATED,
                              range: { id: S.actionId(36, 128), rangeKind: S.RANGE_KIND.SELF }
                            },
                            paths: [
                              {
                                id: S.actionId(36, 129),
                                order: 1,
                                pathCode: S.PATH_CODE.ON_USE,
                                groupType: S.PATH_GROUP_TYPE.SINGLE,
                                originKind: 'SOURCE',
                                selectionKind: 'FIXED',
                                resultBlock: {
                                  id: `${S.actionId(36, 129)}__result`,
                                  resultKind: 'SINGLE',
                                  outcomes: [
                                    {
                                      id: S.actionId(36, 106),
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
      order: 2
    },
    {
      id: S.featureId(36, 3),
      label: 'Death Throes',
      description:
        "Death Throes. When the balor dies, it explodes, and each creature within 30 feet of it must make a DC 20 Dexterity saving throw, taking 70 (20d6) fire damage on a failed save, or half as much damage on a successful one. The explosion ignites flammable objects in that area that aren't being worn or carried, and it destroys the balor's weapons.",
      effects: [
        {
          id: S.actionId(36, 108),
          order: 1,
          invocation: {
            kind: 'PASSIVE',
            triggerCode: S.TRIGGER.HP_ZERO,
            savingThrow: {
              id: S.actionId(36, 109),
              dcMethod: 'FIXED_DC',
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.DEXTERITY,
              baseDc: 20
            },
            range: { id: S.actionId(36, 110), rangeKind: S.RANGE_KIND.SELF },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.AREA_CONTENTS,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            },
            shape: {
              id: S.actionId(36, 130),
              shapeKind: SHAPE_KIND.SPHERE,
              radius: { amount: 30, unit: S.MEASUREMENT_UNIT_CODE.FEET }
            }
          },
          paths: [
            {
              id: S.actionId(36, 111),
              order: 1,
              pathCode: S.PATH_CODE.ON_SAVE_FAIL,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${S.actionId(36, 111)}__result`,
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(36, 112),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('FIRE'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '20d6'
                  }
                ]
              }
            },
            {
              id: S.actionId(36, 114),
              order: 2,
              pathCode: S.PATH_CODE.ON_SAVE_SUCCESS,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: `${S.actionId(36, 114)}__result`,
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: S.actionId(36, 115),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('FIRE'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '20d6',
                    multiplier: 0.5
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
      id: S.featureId(36, 4),
      label: 'Telepathy',
      description: 'telepathy 120 ft.',
      order: 4
    },
    {
      id: S.featureId(36, 5),
      label: 'Multiattack',
      description: 'The balor makes two attacks: one with its longsword and one with its whip.',
      attackSlots: {
        alternatives: [
          {
            slots: [
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(36, 6) }] },
              { count: 1, fillers: [{ kind: 'FEATURE', featureId: S.featureId(36, 7) }] }
            ]
          }
        ]
      },
      order: 5
    },
    {
      id: S.featureId(36, 6),
      label: 'Longsword',
      description:
        'Longsword. Melee Weapon Attack: +14 to hit, reach 10 ft., one target. Hit: 21 (3d8 + 8) slashing damage plus 13 (3d8) lightning damage. If the balor scores a critical hit, it rolls damage dice three times, instead of twice.',
      effects: [
        {
          id: S.actionId(2128, 1),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(2128, 2),
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
              id: S.actionId(2128, 3),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(2128, 3) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(2128, 3),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '3d8',
                    bonuses: [
                      {
                        id: S.actionId(2128, 4),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.STRENGTH,
                        order: 1
                      }
                    ]
                  }
                ]
              }
            },
            {
              id: S.actionId(2128, 5),
              order: 2,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(2128, 5) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(2128, 5),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('LIGHTNING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '3d8'
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
      id: S.featureId(36, 7),
      label: 'Whip',
      description:
        'Whip. Melee Weapon Attack: +14 to hit, reach 30 ft., one target. Hit: 15 (2d6 + 8) slashing damage plus 10 (3d6) fire damage, and the target must succeed on a DC 20 Strength saving throw or be pulled up to 25 feet toward the balor.',
      effects: [
        {
          id: S.actionId(2128, 6),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(2128, 7),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 30,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
              dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
            }
          },
          paths: [
            {
              id: S.actionId(2128, 8),
              order: 1,
              pathCode: S.PATH_CODE.ON_HIT,
              groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(2128, 8) + '__result',
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: S.actionId(2128, 8),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('SLASHING'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '2d6',
                    bonuses: [
                      {
                        id: S.actionId(2128, 9),
                        bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: S.ABILITY_CODE.STRENGTH,
                        order: 1
                      }
                    ]
                  },
                  {
                    id: S.actionId(36, 118),
                    effectKind: S.EFFECT_KIND.DAMAGE,
                    damageTypeId: S.damageTypeId('FIRE'),
                    valueKind: S.DAMAGE_VALUE_KIND.DICE,
                    scalingKind: S.SCALING.NONE,
                    diceConfig: '3d6'
                  },
                  {
                    id: S.actionId(36, 119),
                    effectKind: S.EFFECT_KIND.FOLLOW_UP_SAVE,
                    timing: 'IMMEDIATE',
                    savingThrow: {
                      id: S.actionId(36, 120),
                      dcMethod: 'FIXED_DC',
                      abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.STRENGTH,
                      baseDc: 20
                    },
                    attempts: { kind: 'ONCE' },
                    onSuccess: { kind: 'END' },
                    onFailure: {
                      kind: 'OUTCOMES',
                      endCurrent: true,
                      resultKind: 'SINGLE',
                      outcomes: [
                        {
                          id: S.actionId(36, 123),
                          effectKind: S.EFFECT_KIND.FORCED_MOVEMENT,
                          direction: 'TOWARD_SOURCE',
                          actionEconomy: 'NONE',
                          distanceMode: 'EXACT',
                          amount: 25,
                          unit: S.MEASUREMENT_UNIT_CODE.FEET
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
      order: 7
    },
    {
      id: S.featureId(36, 8),
      label: 'Teleport',
      description:
        'Teleport. The balor magically teleports, along with any equipment it is wearing or carrying, up to 120 feet to an unoccupied space it can see.',
      effects: [
        {
          id: S.actionId(2128, 10),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: S.TRIGGER.ACTIVATED,
            activation: {
              code: S.ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: S.actionId(2128, 11),
              rangeKind: S.RANGE_KIND.DISTANCE,
              amount: 120,
              unit: S.MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: { selectionKind: S.TARGET_SELECTION_KIND.SELF }
          },
          paths: [
            {
              id: S.actionId(2128, 12),
              order: 1,
              pathCode: S.PATH_CODE.ON_USE,
              groupType: S.PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: S.actionId(2128, 12) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: S.actionId(2128, 12),
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
      order: 8
    },
    {
      id: S.featureId(36, 9),
      label: 'Magic Weapons',
      description: "Magic Weapons. The balor's weapon attacks are magical.",
      grants: S.magicWeaponsGrants(36, 901),
      order: 9
    }
  ]
}
