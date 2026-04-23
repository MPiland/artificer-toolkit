import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const copperDragonWyrmling: CreatureAuthored = {
    id: S.CREATURE_IDS.COPPER_DRAGON_WYRMLING,
    label: 'Copper Dragon Wyrmling',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.DRAGON,
    size: S.SIZE_CODE.MEDIUM,
    alignmentId: '00000000-0000-0000-0001-000300000000',
    abilityScores: {
        STRENGTH: 15,
        DEXTERITY: 12,
        CONSTITUTION: 13,
        INTELLIGENCE: 14,
        WISDOM: 11,
        CHARISMA: 13,
        SPELLCASTING: 0
    },
    armorClass: 16,
    armorClassNote: 'natural armor',
    hitPoints: 22,
    hitDice: '4d8+4',
    speeds: [...S.walk(30), ...S.climb(30), ...S.fly(60)],
    proficiencies: [
        S.grantedSaveProficiency(7951, 1, 'DEXTERITY', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
        S.grantedSkillProficiency(7951, 2, 'PERCEPTION', 'STEALTH'),
        S.grantedLanguageProficiency(7951, 3, 'DRACONIC')
    ],
    damageImmunities: ['acid'],
    senses: ['blindsight 10 ft.', 'darkvision 60 ft.'],
    passivePerception: 14,
    challengeRatingId: S.CR.CR_1,
    xp: 200,
    features: [
        {
            id: S.featureId(7951, 1),
            label: 'Bite',
            description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (1d10 + 2) piercing damage.',
            effects: [
                {
                    id: S.actionId(7951, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(7951, 2),
                            rangeKind: S.RANGE_KIND.DISTANCE,
                            amount: 5,
                            unit: S.MEASUREMENT_UNIT_CODE.FEET
                        },
                        targeting: {
                            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(7951, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(7951, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(7951, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d10',
                                        bonuses: [
                                            {
                                                id: S.actionId(7951, 4),
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
            order: 1
        },
        {
            id: S.featureId(7951, 2),
            label: 'Spider Climb',
            description: 'Spider Climb. The dragon can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.',
            order: 2
        },
        {
            id: S.featureId(7951, 3),
            label: 'Breath Weapons (Recharge 5-6)',
            description: 'The dragon uses one of the following breath weapons.',
            effects: [
                {
                    id: S.actionId(7951, 5),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.SAVING_THROW,
                        savingThrow: {
                            id: S.actionId(7951, 6),
                            savingThrowKind: 'SOURCE_SAVE_DC',
                            ability: S.ABILITY_CODE.DEXTERITY
                        },
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(7951, 7),
                            rangeKind: S.RANGE_KIND.SPECIAL
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(7951, 8),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_SAVE_FAIL,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(7951, 8) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(7951, 8),
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
                            id: S.actionId(7951, 9),
                            order: 2,
                            pathCode: S.PATH_CODE.ON_SAVE_SUCCESS,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(7951, 9) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(7951, 9),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('ACID'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '4d8',
                                        multiplier: 0.5
                                    }
                                ]
                            }
                        }
                    ]
                },
                {
                    id: S.actionId(7951, 10),
                    order: 2,
                    invocation: {
                        triggerCode: S.TRIGGER.SAVING_THROW,
                        savingThrow: {
                            id: S.actionId(7951, 11),
                            savingThrowKind: 'SOURCE_SAVE_DC',
                            ability: S.ABILITY_CODE.CONSTITUTION
                        },
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(7951, 12),
                            rangeKind: S.RANGE_KIND.SPECIAL
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(7951, 13),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_SAVE_FAIL,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(7951, 13) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(7951, 13),
                                        effectKind: S.EFFECT_KIND.RULE
                                    }
                                ]
                            }
                        }
                    ]
                }
            ],
            order: 2
        }
    ]
};


