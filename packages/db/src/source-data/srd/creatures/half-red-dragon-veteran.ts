import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const halfRedDragonVeteran: CreatureAuthored = {
    id: S.CREATURE_IDS.HALF_RED_DRAGON_VETERAN,
    label: 'Half-Red Dragon Veteran',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.HUMANOID,
    size: S.SIZE_CODE.MEDIUM,
    tags: ['human'],
    abilityScores: {
        STRENGTH: 16,
        DEXTERITY: 13,
        CONSTITUTION: 14,
        INTELLIGENCE: 10,
        WISDOM: 11,
        CHARISMA: 10,
        SPELLCASTING: 0
    },
    armorClass: 18,
    armorClassNote: 'plate',
    hitPoints: 65,
    hitDice: '10d8+20',
    speeds: [...S.walk(30)],
    proficiencies: [
        S.grantedSkillProficiency(158, 1, 'ATHLETICS', 'PERCEPTION'),
        S.grantedLanguageProficiency(158, 2, 'COMMON', 'DRACONIC')
    ],
    damageResistances: ['fire'],
    senses: ['blindsight 10 ft.', 'darkvision 60 ft.'],
    passivePerception: 12,
    challengeRatingId: S.CR.CR_5,
    xp: 1800,
    features: [
        {
            id: S.featureId(158, 1),
            label: 'Multiattack',
            description: 'Multiattack. The veteran makes two longsword attacks. If it has a shortsword drawn, it can also make a shortsword attack.',
            order: 1
        },
        {
            id: S.featureId(158, 2),
            label: 'Longsword',
            description: 'Longsword. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) slashing damage, or 8 (1d10 + 3) slashing damage if used with two hands.',
            order: 2
        },
        {
            id: S.featureId(158, 3),
            label: 'Shortsword',
            description: 'Shortsword. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) piercing damage.',
            effects: [
                {
                    id: S.actionId(158, 8),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(158, 9),
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
                            id: S.actionId(158, 10),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(158, 10) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(158, 10),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d6',
                                        bonuses: [
                                            {
                                                id: S.actionId(158, 11),
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
            id: S.featureId(158, 4),
            label: 'Heavy Crossbow',
            description: 'Heavy Crossbow. Ranged Weapon Attack: +3 to hit, range 100/400 ft., one target. Hit: 6 (1d10 + 1) piercing damage.',
            effects: [
                {
                    id: S.actionId(158, 12),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(158, 13),
                            rangeKind: S.RANGE_KIND.SPECIAL
                        },
                        targeting: {
                            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(158, 14),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(158, 14) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(158, 14),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d10',
                                        bonuses: [
                                            {
                                                id: S.actionId(158, 15),
                                                bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                                                ability: S.ABILITY_CODE.DEXTERITY,
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
            id: S.featureId(158, 5),
            label: 'Fire Breath (Recharge 5-6)',
            description: 'Fire Breath (Recharge 5-6). The veteran exhales fire in a 15-foot cone. Each creature in that area must make a DC 15 Dexterity saving throw, taking 24 (7d6) fire damage on a failed save, or half as much damage on a successful one.',
            effects: [
                {
                    id: S.actionId(158, 16),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.SAVING_THROW,
                        savingThrow: {
                            id: S.actionId(158, 17),
                            savingThrowKind: 'SOURCE_SAVE_DC',
                            ability: S.ABILITY_CODE.DEXTERITY
                        },
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(158, 18),
                            rangeKind: S.RANGE_KIND.SPECIAL
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(158, 19),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_SAVE_FAIL,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(158, 19) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(158, 19),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('FIRE'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '7d6'
                                    }
                                ]
                            }
                        },
                        {
                            id: S.actionId(158, 20),
                            order: 2,
                            pathCode: S.PATH_CODE.ON_SAVE_SUCCESS,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(158, 20) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(158, 20),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('FIRE'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '7d6',
                                        multiplier: 0.5
                                    }
                                ]
                            }
                        }
                    ]
                }
            ],
            order: 5
        }
    ]
};


