import { DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
import { conditionTypeId } from '../equipment/shared.js';
export const adultWhiteDragon: CreatureAuthored = {
    id: S.CREATURE_IDS.ADULT_WHITE_DRAGON,
    label: 'Adult White Dragon',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.DRAGON,
    size: S.SIZE_CODE.HUGE,
    alignmentId: '00000000-0000-0000-0001-000900000000',
    abilityScores: {
        STRENGTH: 22,
        DEXTERITY: 10,
        CONSTITUTION: 22,
        INTELLIGENCE: 8,
        WISDOM: 12,
        CHARISMA: 12,
    },
    armorClass: 18,
    armorClassNote: 'natural armor',
    hitPoints: 200,
    hitDice: {
      count: 16,
      die: 12,
      modifier: 96,
    },
    speeds: [...S.walk(40), ...S.burrow(30), ...S.fly(80), ...S.swim(40)],
    proficiencies: [
        S.grantedSaveProficiency(12, 1, 'DEXTERITY', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
        S.grantedSkillProficiency(12, 2, 'PERCEPTION', 'STEALTH'),
        S.grantedLanguageProficiency(12, 3, 'COMMON', 'DRACONIC')
    ],
    damageImmunities: ['cold'],
    senses: ['blindsight 60 ft.', 'darkvision 120 ft.'],
    passivePerception: 21,
    challengeRatingId: S.CR.CR_13,
    xp: 10000,
    features: [
        {
            id: S.featureId(12, 1),
            label: 'Ice Walk',
            description: "Ice Walk. The dragon can move across and climb icy surfaces without needing to make an ability check. Additionally, difficult terrain composed of ice or snow doesn't cost it extra movement.",
            order: 1
        },
        {
            id: S.featureId(12, 2),
            label: 'Legendary Resistance (3/Day)',
            description: 'Legendary Resistance (3/Day). If the dragon fails a saving throw, it can choose to succeed instead.',
            attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
            charges: {
                id: S.legendaryActionId(12, 20),
                limitKind: 'FIXED_AMOUNT',
                scalingKind: S.SCALING.NONE,
                resetKind: S.CHARGE_RESET_KIND.MANUAL,
                amount: 3
            },
            order: 2
        },
        {
            id: S.featureId(12, 3),
            label: 'Multiattack',
            description: 'The dragon can use its Frightful Presence. It then makes three attacks: one with its bite and two with its claws.',
            order: 3
        },
        {
            id: S.featureId(12, 4),
            label: 'Bite',
            description: 'Melee Weapon Attack: +11 to hit, reach 10 ft., one target. Hit: 17 (2d10 + 6) piercing damage plus 4 (1d8) cold damage.',
            effects: [
                {
                    id: S.actionId(12, 13),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                        range: {
                            id: S.actionId(12, 14),
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
                            id: S.actionId(12, 15),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(12, 15) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(12, 15),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d10',
                                        bonuses: [
                                            {
                                                id: S.actionId(12, 16),
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
                            id: S.actionId(12, 17),
                            order: 2,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(12, 17) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(12, 17),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('COLD'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d8'
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
            id: S.featureId(12, 5),
            label: 'Claw',
            description: 'Melee Weapon Attack: +11 to hit, reach 5 ft., one target. Hit: 13 (2d6 + 6) slashing damage.',
            effects: [
                {
                    id: S.actionId(12, 18),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                        range: {
                            id: S.actionId(12, 19),
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
                            id: S.actionId(12, 20),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(12, 20) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(12, 20),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('SLASHING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d6',
                                        bonuses: [
                                            {
                                                id: S.actionId(12, 21),
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
            id: S.featureId(12, 6),
            label: 'Tail',
            description: 'Melee Weapon Attack: +11 to hit, reach 15 ft., one target. Hit: 15 (2d8 + 6) bludgeoning damage.',
            effects: [
                {
                    id: S.actionId(12, 22),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                        range: {
                            id: S.actionId(12, 23),
                            rangeKind: S.RANGE_KIND.DISTANCE,
                            amount: 15,
                            unit: S.MEASUREMENT_UNIT_CODE.FEET
                        },
                        targeting: {
                            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
                            dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(12, 24),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(12, 24) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(12, 24),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d8',
                                        bonuses: [
                                            {
                                                id: S.actionId(12, 25),
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
            id: S.featureId(12, 7),
            label: 'Frightful Presence',
            description: "Each creature of the dragon's choice that is within 120 feet of the dragon and aware of it must succeed on a DC 14 Wisdom saving throw or become frightened for 1 minute. A creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success. If a creature's saving throw is successful or the effect ends for it, the creature is immune to the dragon's Frightful Presence for the next 24 hours.",
            effects: [
                {
                    id: S.actionId(12, 26),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.SAVING_THROW,
                        savingThrow: {
                            id: S.actionId(12, 33),
                            dcMethod: 'FIXED_DC',
                            ability: S.ABILITY_CODE.WISDOM,
                            baseDc: 14
                        },
                        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                        range: {
                            id: S.actionId(12, 27),
                            rangeKind: S.RANGE_KIND.DISTANCE,
                            amount: 120,
                            unit: S.MEASUREMENT_UNIT_CODE.FEET
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(12, 28),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_SAVE_FAIL,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(12, 28) + "__result",
                                resultKind: "SINGLE" as const,
                                duration: {
                                    id: S.actionId(12, 34),
                                    durationKind: DURATION_KIND.MINUTE,
                                    amount: 1
                                },
                                outcomes: [
                                    {
                                        id: S.actionId(12, 28),
                                        effectKind: S.EFFECT_KIND.CONDITION,
                                        conditionId: conditionTypeId('FRIGHTENED')
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
            id: S.featureId(12, 8),
            label: 'Cold Breath (Recharge 5-6)',
            description: 'The dragon exhales an icy blast in a 60-foot cone. Each creature in that area must make a DC 19 Constitution saving throw, taking 54 (12d8) cold damage on a failed save, or half as much damage on a successful one.',
            effects: [
                {
                    id: S.actionId(12, 29),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.SAVING_THROW,
                        savingThrow: {
                            id: S.actionId(12, 30),
                            dcMethod: 'FIXED_DC',
                            ability: S.ABILITY_CODE.CONSTITUTION,
                            baseDc: 19
                        },
                        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                        range: { id: S.actionId(12, 31), rangeKind: S.RANGE_KIND.SPECIAL }
                    },
                    paths: [
                        {
                            id: S.actionId(12, 32),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_SAVE_FAIL,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(12, 32) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(12, 32),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('COLD'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '12d8'
                                    }
                                ]
                            }
                        },
                        {
                            id: S.actionId(12, 33),
                            order: 2,
                            pathCode: S.PATH_CODE.ON_SAVE_SUCCESS,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(12, 33) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(12, 33),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('COLD'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '12d8',
                                        multiplier: 0.5
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
            id: S.featureId(12, 9),
            label: 'Legendary Actions',
            section: 'LEGENDARY_ACTION',
            description: "The dragon can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The dragon regains spent legendary actions at the start of its turn.",
            attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
            charges: {
                id: S.legendaryActionId(12, 21),
                limitKind: 'FIXED_AMOUNT',
                scalingKind: S.SCALING.NONE,
                resetKind: S.CHARGE_RESET_KIND.MANUAL,
                amount: 3
            },
            effects: [
                {
                    id: S.legendaryActionId(12, 25),
                    order: 2,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: { code: S.ACTIVATION_CODE.FREE },
                        range: {
                            id: S.legendaryActionId(12, 26),
                            rangeKind: S.RANGE_KIND.DISTANCE,
                            amount: 15,
                            unit: S.MEASUREMENT_UNIT_CODE.FEET
                        },
                        targeting: {
                            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
                            dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
                        }
                    },
                    paths: [
                        {
                            id: S.legendaryActionId(12, 27),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.legendaryActionId(12, 27) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.legendaryActionId(12, 27),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d8+6',
                                        bonuses: [
                                            {
                                                id: S.legendaryActionId(12, 32),
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
                },
                {
                    id: S.legendaryActionId(12, 28),
                    order: 3,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.SAVING_THROW,
                        savingThrow: {
                            id: S.legendaryActionId(12, 31),
                            dcMethod: 'FIXED_DC',
                            ability: S.ABILITY_CODE.DEXTERITY,
                            baseDc: 19
                        },
                        activation: { code: S.ACTIVATION_CODE.FREE },
                        range: { id: S.legendaryActionId(12, 29), rangeKind: S.RANGE_KIND.SPECIAL }
                    },
                    paths: [
                        {
                            id: S.legendaryActionId(12, 30),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_SAVE_FAIL,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.legendaryActionId(12, 30) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.legendaryActionId(12, 30),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d6+6'
                                    }
                                ]
                            }
                        }
                    ]
                }
            ],
            order: 9
        }
    ]
};


