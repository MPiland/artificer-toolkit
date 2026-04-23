import { DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared';
import { conditionTypeId } from '../equipment/shared.js';
import * as S from './shared.js';
export const ancientBronzeDragon: CreatureAuthored = {
    id: S.CREATURE_IDS.ANCIENT_BRONZE_DRAGON,
    label: 'Ancient Bronze Dragon',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.DRAGON,
    size: S.SIZE_CODE.GARGANTUAN,
    alignmentId: '00000000-0000-0000-0001-000100000000',
    abilityScores: {
        STRENGTH: 29,
        DEXTERITY: 10,
        CONSTITUTION: 27,
        INTELLIGENCE: 18,
        WISDOM: 17,
        CHARISMA: 21,
        SPELLCASTING: 0
    },
    armorClass: 22,
    armorClassNote: 'natural armor',
    hitPoints: 444,
    hitDice: '24d20+192',
    speeds: [...S.walk(40), ...S.fly(80), ...S.swim(40)],
    proficiencies: [
        S.grantedSaveProficiency(5407, 1, 'DEXTERITY', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
        S.grantedSkillProficiency(5407, 2, 'INSIGHT', 'PERCEPTION', 'STEALTH'),
        S.grantedLanguageProficiency(5407, 3, 'COMMON', 'DRACONIC')
    ],
    damageImmunities: ['lightning'],
    senses: ['blindsight 60 ft.', 'darkvision 120 ft.'],
    passivePerception: 27,
    challengeRatingId: S.CR.CR_22,
    xp: 41000,
    features: [
        {
            id: S.featureId(5407, 1),
            label: 'Amphibious',
            description: 'Amphibious. The dragon can breathe air and water.',
            order: 1
        },
        {
            id: S.featureId(5407, 2),
            label: 'Legendary Resistance (3/Day)',
            description: 'Legendary Resistance (3/Day). If the dragon fails a saving throw, it can choose to succeed instead.',
            attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
            charges: {
                id: S.legendaryActionId(5407, 20),
                limitKind: 'FIXED_AMOUNT',
                scalingKind: S.SCALING.NONE,
                resetKind: S.CHARGE_RESET_KIND.MANUAL,
                amount: 3
            },
            order: 2
        },
        {
            id: S.featureId(5407, 3),
            label: 'Multiattack',
            description: 'The dragon can use its Frightful Presence. It then makes three attacks: one with its bite and two with its claws.',
            effects: [
                {
                    id: S.actionId(5407, 10),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.ACTIVATED,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(5407, 11),
                            rangeKind: S.RANGE_KIND.SPECIAL
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(5407, 12),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_USE,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(5407, 12) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(5407, 12),
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
            id: S.featureId(5407, 4),
            label: 'Bite',
            description: 'Melee Weapon Attack: +16 to hit, reach 15 ft., one target. Hit: 19 (2d10 + 9) piercing damage.',
            effects: [
                {
                    id: S.actionId(5407, 13),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(5407, 14),
                            rangeKind: S.RANGE_KIND.DISTANCE,
                            amount: 15,
                            unit: S.MEASUREMENT_UNIT_CODE.FEET
                        },
                        targeting: {
                            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(5407, 15),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(5407, 15) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(5407, 15),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d10',
                                        bonuses: [
                                            {
                                                id: S.actionId(5407, 16),
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
            id: S.featureId(5407, 5),
            label: 'Claw',
            description: 'Melee Weapon Attack: +16 to hit, reach 10 ft., one target. Hit: 15 (2d6 + 9) slashing damage.',
            effects: [
                {
                    id: S.actionId(5407, 17),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(5407, 18),
                            rangeKind: S.RANGE_KIND.DISTANCE,
                            amount: 10,
                            unit: S.MEASUREMENT_UNIT_CODE.FEET
                        },
                        targeting: {
                            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(5407, 19),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(5407, 19) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(5407, 19),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('SLASHING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d6',
                                        bonuses: [
                                            {
                                                id: S.actionId(5407, 20),
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
            id: S.featureId(5407, 6),
            label: 'Tail',
            description: 'Melee Weapon Attack: +16 to hit, reach 20 ft., one target. Hit: 17 (2d8 + 9) bludgeoning damage.',
            effects: [
                {
                    id: S.actionId(5407, 21),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(5407, 22),
                            rangeKind: S.RANGE_KIND.DISTANCE,
                            amount: 20,
                            unit: S.MEASUREMENT_UNIT_CODE.FEET
                        },
                        targeting: {
                            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(5407, 23),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(5407, 23) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(5407, 23),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d8',
                                        bonuses: [
                                            {
                                                id: S.actionId(5407, 24),
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
            id: S.featureId(5407, 7),
            label: 'Frightful Presence',
            description: "Each creature of the dragon's choice that is within 120 feet of the dragon and aware of it must succeed on a DC 20 Wisdom saving throw or become frightened for 1 minute. A creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success. If a creature's saving throw is successful or the effect ends for it, the creature is immune to the dragon's Frightful Presence for the next 24 hours.",
            effects: [
                {
                    id: S.actionId(5407, 25),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.SAVING_THROW,
                        savingThrow: {
                            id: S.actionId(5407, 33),
                            savingThrowKind: 'SOURCE_SAVE_DC',
                            ability: S.ABILITY_CODE.WISDOM
                        },
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(5407, 26),
                            rangeKind: S.RANGE_KIND.DISTANCE,
                            amount: 120,
                            unit: S.MEASUREMENT_UNIT_CODE.FEET
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(5407, 27),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_SAVE_FAIL,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(5407, 27) + "__result",
                                resultKind: "SINGLE" as const,
                                duration: {
                                    id: S.actionId(5407, 34),
                                    durationKind: DURATION_KIND.MINUTE,
                                    amount: 1
                                },
                                outcomes: [
                                    {
                                        id: S.actionId(5407, 27),
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
            id: S.featureId(5407, 8),
            label: 'Lightning Breath (Recharge 5-6)',
            description: 'The dragon exhales lightning in a 120-foot line that is 10 feet wide. Each creature in that line must make a DC 23 Dexterity saving throw, taking 88 (16d10) lightning damage on a failed save, or half as much damage on a successful one.',
            effects: [
                {
                    id: S.actionId(5407, 28),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.SAVING_THROW,
                        savingThrow: {
                            id: S.actionId(5407, 29),
                            savingThrowKind: 'SOURCE_SAVE_DC',
                            ability: S.ABILITY_CODE.DEXTERITY
                        },
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(5407, 30),
                            rangeKind: S.RANGE_KIND.SPECIAL
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(5407, 31),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_SAVE_FAIL,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(5407, 31) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(5407, 31),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('LIGHTNING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '16d10'
                                    }
                                ]
                            }
                        },
                        {
                            id: S.actionId(5407, 32),
                            order: 2,
                            pathCode: S.PATH_CODE.ON_SAVE_SUCCESS,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(5407, 32) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(5407, 32),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('LIGHTNING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '16d10',
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
            id: S.featureId(5407, 9),
            label: 'Repulsion Breath (Recharge 5-6)',
            description: 'The dragon exhales repulsion energy in a 30-foot cone. Each creature in that area must succeed on a DC 23 Strength saving throw. On a failed save, the creature is pushed 60 feet away from the dragon.',
            effects: [
                {
                    id: S.actionId(5407, 35),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.SAVING_THROW,
                        savingThrow: {
                            id: S.actionId(5407, 36),
                            savingThrowKind: 'SOURCE_SAVE_DC',
                            ability: S.ABILITY_CODE.STRENGTH
                        },
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(5407, 37),
                            rangeKind: S.RANGE_KIND.SPECIAL
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(5407, 38),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_SAVE_FAIL,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(5407, 38) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(5407, 38),
                                        effectKind: S.EFFECT_KIND.RULE
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
            id: S.featureId(5407, 10),
            label: 'Change Shape',
            description: "The dragon magically polymorphs into a humanoid or beast that has a challenge rating no higher than its own, or back into its true form. It reverts to its true form if it dies. Any equipment it is wearing or carrying is absorbed or borne by the new form (the dragon's choice). In a new form, the dragon retains its alignment, hit points, Hit Dice, ability to speak, proficiencies, Legendary Resistance, lair actions, and Intelligence, Wisdom, and Charisma scores, as well as this action. Its statistics and capabilities are otherwise replaced by those of the new form, except any class features, legendary actions, and lair actions of that form.",
            effects: [
                {
                    id: S.actionId(5407, 39),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.ACTIVATED,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(5407, 40),
                            rangeKind: S.RANGE_KIND.SELF
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(5407, 41),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_USE,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(5407, 41) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(5407, 41),
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
            id: S.featureId(5407, 11),
            label: 'Legendary Actions',
            description: "The dragon can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The dragon regains spent legendary actions at the start of its turn.",
            attributes: [S.FEATURE_ATTRIBUTE.LIMITED_USE],
            charges: {
                id: S.legendaryActionId(5407, 21),
                limitKind: 'FIXED_AMOUNT',
                scalingKind: S.SCALING.NONE,
                resetKind: S.CHARGE_RESET_KIND.MANUAL,
                amount: 3
            },
            effects: [
                {
                    id: S.legendaryActionId(5407, 22),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.ACTIVATED,
                        activation: {
                            code: S.ACTIVATION_CODE.FREE
                        },
                        range: {
                            id: S.legendaryActionId(5407, 23),
                            rangeKind: S.RANGE_KIND.SPECIAL
                        }
                    },
                    paths: [
                        {
                            id: S.legendaryActionId(5407, 24),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_USE,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.legendaryActionId(5407, 24) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.legendaryActionId(5407, 24),
                                        effectKind: S.EFFECT_KIND.RULE
                                    }
                                ]
                            }
                        }
                    ]
                },
                {
                    id: S.legendaryActionId(5407, 25),
                    order: 2,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.FREE
                        },
                        range: {
                            id: S.legendaryActionId(5407, 26),
                            rangeKind: S.RANGE_KIND.DISTANCE,
                            amount: 20,
                            unit: S.MEASUREMENT_UNIT_CODE.FEET
                        },
                        targeting: {
                            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
                        }
                    },
                    paths: [
                        {
                            id: S.legendaryActionId(5407, 27),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.legendaryActionId(5407, 27) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.legendaryActionId(5407, 27),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d8',
                                        bonuses: [
                                            {
                                                id: S.legendaryActionId(5407, 28),
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
                    id: S.legendaryActionId(5407, 29),
                    order: 3,
                    invocation: {
                        triggerCode: S.TRIGGER.SAVING_THROW,
                        savingThrow: {
                            id: S.legendaryActionId(5407, 31),
                            savingThrowKind: 'SOURCE_SAVE_DC',
                            ability: S.ABILITY_CODE.DEXTERITY
                        },
                        activation: {
                            code: S.ACTIVATION_CODE.FREE
                        },
                        range: {
                            id: S.legendaryActionId(5407, 30),
                            rangeKind: S.RANGE_KIND.SPECIAL
                        }
                    },
                    paths: [
                        {
                            id: S.legendaryActionId(5407, 32),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_SAVE_FAIL,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.legendaryActionId(5407, 32) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.legendaryActionId(5407, 32),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d6+9'
                                    }
                                ]
                            }
                        },
                        {
                            id: S.legendaryActionId(5407, 33),
                            order: 2,
                            pathCode: S.PATH_CODE.ON_SAVE_FAIL,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.legendaryActionId(5407, 33) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.legendaryActionId(5407, 33),
                                        effectKind: S.EFFECT_KIND.CONDITION,
                                        conditionId: conditionTypeId('PRONE')
                                    }
                                ]
                            }
                        }
                    ]
                }
            ],
            order: 11
        }
    ]
};


