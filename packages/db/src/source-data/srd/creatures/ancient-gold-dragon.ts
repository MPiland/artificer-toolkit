import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const ancientGoldDragon: CreatureAuthored = {
    id: S.CREATURE_IDS.ANCIENT_GOLD_DRAGON,
    label: 'Ancient Gold Dragon',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.DRAGON,
    size: S.SIZE_CODE.GARGANTUAN,
    alignmentId: '00000000-0000-0000-0001-000100000000',
    abilityScores: {
        STRENGTH: 30,
        DEXTERITY: 14,
        CONSTITUTION: 29,
        INTELLIGENCE: 18,
        WISDOM: 17,
        CHARISMA: 28,
        SPELLCASTING: 0
    },
    armorClass: 22,
    armorClassNote: 'natural armor',
    hitPoints: 546,
    hitDice: '28d20+252',
    speeds: [...S.walk(40), ...S.fly(80), ...S.swim(40)],
    proficiencies: [
        S.grantedSaveProficiency(19, 1, 'DEXTERITY', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
        S.grantedSkillProficiency(19, 2, 'INSIGHT', 'PERCEPTION', 'PERSUASION'),
        S.grantedLanguageProficiency(19, 3, 'COMMON', 'DRACONIC')
    ],
    damageImmunities: ['fire'],
    senses: ['blindsight 60 ft.', 'darkvision 120 ft.'],
    passivePerception: 27,
    challengeRatingId: S.CR.CR_24,
    xp: 62000,
    features: [
        {
            id: S.featureId(19, 1),
            label: 'Amphibious',
            description: 'Amphibious. The dragon can breathe air and water.',
            order: 1
        },
        {
            id: S.featureId(19, 2),
            label: 'Legendary Resistance (3/Day)',
            description: 'Legendary Resistance (3/Day). If the dragon fails a saving throw, it can choose to succeed instead.',
            attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
            charges: {
                id: S.legendaryActionId(19, 20),
                limitKind: 'FIXED_AMOUNT',
                scalingKind: S.SCALING.NONE,
                resetKind: S.CHARGE_RESET_KIND.MANUAL,
                amount: 3
            },
            order: 2
        },
        {
            id: S.featureId(19, 3),
            label: 'Multiattack',
            description: 'The dragon can use its Frightful Presence. It then makes three attacks: one with its bite and two with its claws.',
            effects: [
                {
                    id: S.actionId(19, 10),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.ACTIVATED,
                        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                        range: { id: S.actionId(19, 11), rangeKind: S.RANGE_KIND.SPECIAL }
                    },
                    paths: [
                        {
                            id: S.actionId(19, 12),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_USE,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(19, 12) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(19, 12),
                                        effectKind: S.EFFECT_KIND.RULE
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
            id: S.featureId(19, 4),
            label: 'Bite',
            description: 'Melee Weapon Attack: +17 to hit, reach 15 ft., one target. Hit: 21 (2d10 + 10) piercing damage.',
            effects: [
                {
                    id: S.actionId(19, 13),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                        range: {
                            id: S.actionId(19, 14),
                            rangeKind: S.RANGE_KIND.DISTANCE,
                            amount: 15,
                            unit: S.MEASUREMENT_UNIT_CODE.FEET
                        },
                        targeting: {
                            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(19, 15),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(19, 15) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(19, 15),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d10',
                                        bonuses: [
                                            {
                                                id: S.actionId(19, 16),
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
            id: S.featureId(19, 5),
            label: 'Claw',
            description: 'Melee Weapon Attack: +17 to hit, reach 10 ft., one target. Hit: 17 (2d6 + 10) slashing damage.',
            effects: [
                {
                    id: S.actionId(19, 17),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                        range: {
                            id: S.actionId(19, 18),
                            rangeKind: S.RANGE_KIND.DISTANCE,
                            amount: 10,
                            unit: S.MEASUREMENT_UNIT_CODE.FEET
                        },
                        targeting: {
                            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(19, 19),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(19, 19) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(19, 19),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('SLASHING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d6',
                                        bonuses: [
                                            {
                                                id: S.actionId(19, 20),
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
            id: S.featureId(19, 6),
            label: 'Tail',
            description: 'Melee Weapon Attack: +17 to hit, reach 20 ft., one target. Hit: 19 (2d8 + 10) bludgeoning damage.',
            effects: [
                {
                    id: S.actionId(19, 21),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                        range: {
                            id: S.actionId(19, 22),
                            rangeKind: S.RANGE_KIND.DISTANCE,
                            amount: 20,
                            unit: S.MEASUREMENT_UNIT_CODE.FEET
                        },
                        targeting: {
                            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(19, 23),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(19, 23) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(19, 23),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d8',
                                        bonuses: [
                                            {
                                                id: S.actionId(19, 24),
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
            id: S.featureId(19, 7),
            label: 'Frightful Presence',
            description: "Each creature of the dragon's choice that is within 120 feet of the dragon and aware of it must succeed on a DC 24 Wisdom saving throw or become frightened for 1 minute. A creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success. If a creature's saving throw is successful or the effect ends for it, the creature is immune to the dragon's Frightful Presence for the next 24 hours.",
            effects: [
                {
                    id: S.actionId(19, 25),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.ACTIVATED,
                        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                        range: {
                            id: S.actionId(19, 26),
                            rangeKind: S.RANGE_KIND.DISTANCE,
                            amount: 120,
                            unit: S.MEASUREMENT_UNIT_CODE.FEET
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(19, 27),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_USE,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(19, 27) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(19, 27),
                                        effectKind: S.EFFECT_KIND.RULE
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
            id: S.featureId(19, 8),
            label: 'Breath Weapons (Recharge 5-6)',
            description: 'The dragon uses one of the following breath weapons.',
            effects: [
                {
                    id: S.actionId(19, 28),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.ACTIVATED,
                        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                        range: { id: S.actionId(19, 29), rangeKind: S.RANGE_KIND.SPECIAL }
                    },
                    paths: [
                        {
                            id: S.actionId(19, 30),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_USE,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(19, 30) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(19, 30),
                                        effectKind: S.EFFECT_KIND.RULE
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
            id: S.featureId(19, 9),
            label: 'Fire Breath (Recharge 5-6)',
            description: 'The dragon exhales fire in a 90-foot cone. Each creature in that area must make a DC 24 Dexterity saving throw, taking 71 (13d10) fire damage on a failed save, or half as much damage on a successful one.',
            effects: [
                {
                    id: S.actionId(19, 31),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.SAVING_THROW,
                        savingThrow: {
                            id: S.actionId(19, 32),
                            savingThrowKind: 'SOURCE_SAVE_DC',
                            ability: S.ABILITY_CODE.DEXTERITY
                        },
                        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                        range: { id: S.actionId(19, 33), rangeKind: S.RANGE_KIND.SPECIAL }
                    },
                    paths: [
                        {
                            id: S.actionId(19, 34),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_SAVE_FAIL,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(19, 34) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(19, 34),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('FIRE'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '13d10'
                                    }
                                ]
                            }
                        },
                        {
                            id: S.actionId(19, 35),
                            order: 2,
                            pathCode: S.PATH_CODE.ON_SAVE_SUCCESS,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(19, 35) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(19, 35),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('FIRE'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '13d10',
                                        multiplier: 0.5
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
            id: S.featureId(19, 10),
            label: 'Weakening Breath (Recharge 5-6)',
            description: 'The dragon exhales gas in a 90-foot cone. Each creature in that area must succeed on a DC 24 Strength saving throw or have disadvantage on Strength-based attack rolls, Strength checks, and Strength saving throws for 1 minute. A creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success.',
            effects: [
                {
                    id: S.actionId(19, 36),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.SAVING_THROW,
                        savingThrow: {
                            id: S.actionId(19, 37),
                            savingThrowKind: 'SOURCE_SAVE_DC',
                            ability: S.ABILITY_CODE.STRENGTH
                        },
                        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                        range: { id: S.actionId(19, 38), rangeKind: S.RANGE_KIND.SPECIAL }
                    },
                    paths: [
                        {
                            id: S.actionId(19, 39),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_SAVE_FAIL,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(19, 39) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(19, 39),
                                        effectKind: S.EFFECT_KIND.RULE
                                    }
                                ]
                            }
                        }
                    ]
                }
            ],
            order: 10
        },
        {
            id: S.featureId(19, 11),
            label: 'Change Shape',
            description: "The dragon magically polymorphs into a humanoid or beast that has a challenge rating no higher than its own, or back into its true form. It reverts to its true form if it dies. Any equipment it is wearing or carrying is absorbed or borne by the new form (the dragon's choice). In a new form, the dragon retains its alignment, hit points, Hit Dice, ability to speak, proficiencies, Legendary Resistance, lair actions, and Intelligence, Wisdom, and Charisma scores, as well as this action. Its statistics and capabilities are otherwise replaced by those of the new form, except any class features, legendary actions, and lair actions of that form.",
            effects: [
                {
                    id: S.actionId(19, 40),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.ACTIVATED,
                        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                        range: { id: S.actionId(19, 41), rangeKind: S.RANGE_KIND.SELF }
                    },
                    paths: [
                        {
                            id: S.actionId(19, 42),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_USE,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(19, 42) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(19, 42),
                                        effectKind: S.EFFECT_KIND.RULE
                                    }
                                ]
                            }
                        }
                    ]
                }
            ],
            order: 11
        },
        {
            id: S.featureId(19, 12),
            label: 'Legendary Actions',
            description: "The dragon can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The dragon regains spent legendary actions at the start of its turn.",
            attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
            charges: {
                id: S.legendaryActionId(19, 21),
                limitKind: 'FIXED_AMOUNT',
                scalingKind: S.SCALING.NONE,
                resetKind: S.CHARGE_RESET_KIND.MANUAL,
                amount: 3
            },
            effects: [
                {
                    id: S.legendaryActionId(19, 22),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.ACTIVATED,
                        activation: { code: S.ACTIVATION_CODE.FREE },
                        range: { id: S.legendaryActionId(19, 23), rangeKind: S.RANGE_KIND.SPECIAL }
                    },
                    paths: [
                        {
                            id: S.legendaryActionId(19, 24),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_USE,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.legendaryActionId(19, 24) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.legendaryActionId(19, 24),
                                        effectKind: S.EFFECT_KIND.RULE
                                    }
                                ]
                            }
                        }
                    ]
                },
                {
                    id: S.legendaryActionId(19, 25),
                    order: 2,
                    invocation: {
                        triggerCode: S.TRIGGER.ACTIVATED,
                        activation: { code: S.ACTIVATION_CODE.FREE },
                        range: { id: S.legendaryActionId(19, 26), rangeKind: S.RANGE_KIND.SPECIAL }
                    },
                    paths: [
                        {
                            id: S.legendaryActionId(19, 27),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_USE,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.legendaryActionId(19, 27) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.legendaryActionId(19, 27),
                                        effectKind: S.EFFECT_KIND.RULE
                                    }
                                ]
                            }
                        }
                    ]
                },
                {
                    id: S.legendaryActionId(19, 28),
                    order: 3,
                    invocation: {
                        triggerCode: S.TRIGGER.ACTIVATED,
                        activation: { code: S.ACTIVATION_CODE.FREE },
                        range: { id: S.legendaryActionId(19, 29), rangeKind: S.RANGE_KIND.SPECIAL }
                    },
                    paths: [
                        {
                            id: S.legendaryActionId(19, 30),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_USE,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.legendaryActionId(19, 30) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.legendaryActionId(19, 30),
                                        effectKind: S.EFFECT_KIND.RULE
                                    }
                                ]
                            }
                        }
                    ]
                }
            ],
            order: 12
        }
    ]
};


