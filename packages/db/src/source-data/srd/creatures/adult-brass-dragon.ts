import { TARGET_DISPOSITION_KIND, DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared';
import { conditionTypeId } from '../equipment/shared.js';
import * as S from './shared.js';
export const adultBrassDragon: CreatureAuthored = {
    id: S.CREATURE_IDS.ADULT_BRASS_DRAGON,
    label: 'Adult Brass Dragon',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.DRAGON,
    size: S.SIZE_CODE.HUGE,
    alignmentId: '00000000-0000-0000-0001-000300000000',
    abilityScores: {
        STRENGTH: 23,
        DEXTERITY: 10,
        CONSTITUTION: 21,
        INTELLIGENCE: 14,
        WISDOM: 13,
        CHARISMA: 17,
        SPELLCASTING: 0
    },
    armorClass: 18,
    armorClassNote: 'natural armor',
    hitPoints: 172,
    hitDice: '15d12+75',
    speeds: [...S.walk(40), ...S.burrow(30), ...S.fly(80)],
    proficiencies: [
        S.grantedSaveProficiency(5, 1, 'DEXTERITY', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
        S.grantedSkillProficiency(5, 2, 'HISTORY', 'PERCEPTION', 'PERSUASION', 'STEALTH'),
        S.grantedLanguageProficiency(5, 3, 'COMMON', 'DRACONIC')
    ],
    senses: ['blindsight 60 ft.', 'darkvision 120 ft.'],
    passivePerception: 21,
    challengeRatingId: S.CR.CR_13,
    xp: 10000,
    features: [
        {
            id: S.featureId(5, 1),
            label: 'Legendary Resistance (3/Day)',
            description: 'Legendary Resistance (3/Day). If the dragon fails a saving throw, it can choose to succeed instead.',
            attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
            charges: {
                id: S.legendaryActionId(5, 20),
                limitKind: 'FIXED_AMOUNT',
                scalingKind: S.SCALING.NONE,
                resetKind: S.CHARGE_RESET_KIND.MANUAL,
                amount: 3
            },
            order: 1
        },
        {
            id: S.featureId(5, 2),
            label: 'Multiattack',
            description: 'The dragon can use its Frightful Presence. It then makes three attacks: one with its bite and two with its claws.',
            order: 2
        },
        {
            id: S.featureId(5, 3),
            label: 'Bite',
            description: 'Melee Weapon Attack: +11 to hit, reach 10 ft., one target. Hit: 17 (2d10 + 6) piercing damage.',
            effects: [
                {
                    id: S.actionId(5, 12),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                        range: {
                            id: S.actionId(5, 13),
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
                            id: S.actionId(5, 14),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(5, 14) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(5, 14),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d10',
                                        bonuses: [
                                            {
                                                id: S.actionId(5, 15),
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
            order: 3
        },
        {
            id: S.featureId(5, 4),
            label: 'Claw',
            description: 'Melee Weapon Attack: +11 to hit, reach 5 ft., one target. Hit: 13 (2d6 + 6) slashing damage.',
            effects: [
                {
                    id: S.actionId(5, 16),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                        range: {
                            id: S.actionId(5, 17),
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
                            id: S.actionId(5, 18),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(5, 18) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(5, 18),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('SLASHING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d6',
                                        bonuses: [
                                            {
                                                id: S.actionId(5, 19),
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
            id: S.featureId(5, 5),
            label: 'Tail',
            description: 'Melee Weapon Attack: +11 to hit, reach 15 ft., one target. Hit: 15 (2d8 + 6) bludgeoning damage.',
            effects: [
                {
                    id: S.actionId(5, 20),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                        range: {
                            id: S.actionId(5, 21),
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
                            id: S.actionId(5, 22),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(5, 22) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(5, 22),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d8',
                                        bonuses: [
                                            {
                                                id: S.actionId(5, 23),
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
            id: S.featureId(5, 6),
            label: 'Frightful Presence',
            description: "Each creature of the dragon's choice that is within 120 feet of the dragon and aware of it must succeed on a DC 16 Wisdom saving throw or become frightened for 1 minute. A creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success. If a creature's saving throw is successful or the effect ends for it, the creature is immune to the dragon's Frightful Presence for the next 24 hours.",
            effects: [
                {
                    id: S.actionId(5, 24),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.SAVING_THROW,
                        savingThrow: {
                            id: S.actionId(5, 99),
                            dcMethod: 'FIXED_DC',
                            ability: S.ABILITY_CODE.WISDOM,
                            baseDc: 16
                        },
                        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                        range: {
                            id: S.actionId(5, 25),
                            rangeKind: S.RANGE_KIND.DISTANCE,
                            amount: 120,
                            unit: S.MEASUREMENT_UNIT_CODE.FEET
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(5, 26),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_SAVE_FAIL,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(5, 26) + "__result",
                                resultKind: "SINGLE" as const,
                                duration: {
                                    id: S.actionId(5, 100),
                                    durationKind: DURATION_KIND.MINUTE,
                                    amount: 1
                                },
                                outcomes: [
                                    {
                                        id: S.actionId(5, 26),
                                        effectKind: S.EFFECT_KIND.CONDITION,
                                        conditionId: conditionTypeId('FRIGHTENED')
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
            id: S.featureId(5, 7),
            label: 'Breath Weapons (Recharge 5-6)',
            description: 'The dragon uses one of the following breath weapons.',
            order: 7
        },
        {
            id: S.featureId(5, 8),
            label: 'Fire Breath',
            description: 'The dragon exhales fire in a 60-foot line that is 5 feet wide. Each creature in that line must make a DC 18 Dexterity saving throw, taking 45 (13d6) fire damage on a failed save, or half as much damage on a successful one.',
            effects: [
                {
                    id: S.actionId(5, 30),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.SAVING_THROW,
                        savingThrow: {
                            id: S.actionId(5, 31),
                            dcMethod: 'FIXED_DC',
                            ability: S.ABILITY_CODE.DEXTERITY,
                            baseDc: 18
                        },
                        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                        range: { id: S.actionId(5, 32), rangeKind: S.RANGE_KIND.SPECIAL }
                    },
                    paths: [
                        {
                            id: S.actionId(5, 33),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_SAVE_FAIL,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(5, 33) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(5, 33),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('FIRE'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '13d6'
                                    }
                                ]
                            }
                        },
                        {
                            id: S.actionId(5, 34),
                            order: 2,
                            pathCode: S.PATH_CODE.ON_SAVE_SUCCESS,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(5, 34) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(5, 34),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('FIRE'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '13d6',
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
            id: S.featureId(5, 9),
            label: 'Sleep Breath',
            description: 'The dragon exhales sleep gas in a 60-foot cone. Each creature in that area must succeed on a DC 18 Constitution saving throw or fall unconscious for 10 minutes. This effect ends for a creature if the creature takes damage or someone uses an action to wake it.',
            effects: [
                {
                    id: S.actionId(5, 35),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.SAVING_THROW,
                        savingThrow: {
                            id: S.actionId(5, 36),
                            dcMethod: 'FIXED_DC',
                            ability: S.ABILITY_CODE.CONSTITUTION,
                            baseDc: 18
                        },
                        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                        range: { id: S.actionId(5, 37), rangeKind: S.RANGE_KIND.SPECIAL }
                    },
                    paths: [
                        {
                            id: S.actionId(5, 38),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_SAVE_FAIL,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(5, 38) + "__result",
                                resultKind: "SINGLE" as const,
                                duration: {
                                    id: S.actionId(5, 100),
                                    durationKind: DURATION_KIND.MINUTE,
                                    amount: 10
                                },
                                outcomes: [
                                    {
                                        id: S.actionId(5, 38),
                                        effectKind: S.EFFECT_KIND.CONDITION,
                                        conditionId: conditionTypeId('UNCONSCIOUS')
                                    }
                                ]
                            }
                        }
                    ]
                }
            ],
            order: 9
        },
        {
            id: S.featureId(5, 10),
            label: 'Legendary Actions',
            description: '<p>The dragon can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature\'s turn. The dragon regains spent legendary actions at the start of its turn.</p><p><strong>Detect.</strong> The dragon makes a Wisdom (Perception) check.</p><p><strong>Tail Attack.</strong> The dragon makes a tail attack.</p><p><strong>Wing Attack (Costs 2 Actions).</strong> The dragon beats its wings. Each creature within 10 feet of the dragon must succeed on a DC 19 Dexterity saving throw or take 13 (2d6 + 6) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.</p>',
            attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
            charges: {
                id: S.legendaryActionId(5, 21),
                limitKind: 'FIXED_AMOUNT',
                scalingKind: S.SCALING.NONE,
                resetKind: S.CHARGE_RESET_KIND.MANUAL,
                amount: 3
            },
            effects: [
                {
                    id: S.legendaryActionId(5, 25),
                    order: 2,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: { code: S.ACTIVATION_CODE.FREE },
                        range: {
                            id: S.legendaryActionId(5, 26),
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
                            id: S.legendaryActionId(5, 27),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.legendaryActionId(5, 27) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.legendaryActionId(5, 27),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d8+6',
                                        bonuses: [
                                            {
                                                id: S.legendaryActionId(5, 32),
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
                    id: S.legendaryActionId(5, 28),
                    order: 3,
                    invocation: {
                        triggerCode: S.TRIGGER.SAVING_THROW,
                        savingThrow: {
                            id: S.legendaryActionId(5, 31),
                            dcMethod: 'FIXED_DC',
                            ability: S.ABILITY_CODE.DEXTERITY,
                            baseDc: 19
                        },
                        activation: { code: S.ACTIVATION_CODE.FREE },
                        range: { id: S.legendaryActionId(5, 29), rangeKind: S.RANGE_KIND.SPECIAL }
                    },
                    paths: [
                        {
                            id: S.legendaryActionId(5, 30),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_SAVE_FAIL,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.legendaryActionId(5, 30) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.legendaryActionId(5, 30),
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
            order: 10
        }
    ]
};


