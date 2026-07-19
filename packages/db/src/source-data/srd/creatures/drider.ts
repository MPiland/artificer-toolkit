import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const drider: CreatureAuthored = {
    id: S.CREATURE_IDS.DRIDER,
    label: 'Drider',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
    size: S.SIZE_CODE.LARGE,
    alignmentId: '00000000-0000-0000-0001-000900000000',
    abilityScores: {
        STRENGTH: 16,
        DEXTERITY: 16,
        CONSTITUTION: 18,
        INTELLIGENCE: 13,
        WISDOM: 14,
        CHARISMA: 12,
    },
    armorClass: 19,
    armorClassNote: 'natural armor',
    hitPoints: 123,
    hitDice: '13d10+52',
    speeds: [...S.walk(30), ...S.climb(30)],
    proficiencies: [
        S.grantedSkillProficiency(87, 1, 'PERCEPTION', 'STEALTH'),
        S.grantedLanguageProficiency(87, 2, 'ELVISH', 'UNDERCOMMON')
    ],
    senses: ['darkvision 120 ft.'],
    passivePerception: 15,
    challengeRatingId: S.CR.CR_6,
    xp: 2300,
    features: [
        {
            id: S.featureId(87, 1),
            label: 'Fey Ancestry',
            description: "Fey Ancestry. The drider has advantage on saving throws against being charmed, and magic can't put the drider to sleep.",
            order: 1
        },
        {
            id: S.featureId(87, 2),
            label: 'Innate Spellcasting',
            description: "Innate Spellcasting. The drider's innate spellcasting ability is Wisdom (spell save DC 13). The drider can innately cast the following spells, requiring no material components: At will: dancing lights. 1/day each: darkness, faerie fire.",
            order: 2
        },
        {
            id: S.featureId(87, 3),
            label: 'Spider Climb',
            description: 'Spider Climb. The drider can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.',
            order: 3
        },
        {
            id: S.featureId(87, 4),
            label: 'Sunlight Sensitivity',
            description: 'Sunlight Sensitivity. While in sunlight, the drider has disadvantage on attack rolls, as well as on Wisdom (Perception) checks that rely on sight.',
            order: 4
        },
        {
            id: S.featureId(87, 5),
            label: 'Web Walker',
            description: 'Web Walker. The drider ignores movement restrictions caused by webbing.',
            order: 5
        },
        {
            id: S.featureId(87, 6),
            label: 'Multiattack',
            description: 'Multiattack. The drider makes three attacks, either with its longsword or its longbow. It can replace one of those attacks with a bite attack.',
            order: 6
        },
        {
            id: S.featureId(87, 7),
            label: 'Bite',
            description: 'Bite. Melee Weapon Attack: +6 to hit, reach 5 ft., one creature. Hit: 2 (1d4) piercing damage plus 9 (2d8) poison damage.',
            effects: [
                {
                    id: S.actionId(87, 4),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(87, 5),
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
                            id: S.actionId(87, 6),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(87, 6) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(87, 6),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d4'
                                    }
                                ]
                            }
                        },
                        {
                            id: S.actionId(87, 7),
                            order: 2,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(87, 7) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(87, 7),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('POISON'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d8'
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
            id: S.featureId(87, 8),
            label: 'Longsword',
            description: 'Longsword. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) slashing damage, or 8 (1d10 + 3) slashing damage if used with two hands.',
            effects: [
                {
                    id: S.actionId(87, 8),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(87, 9),
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
                            id: S.actionId(87, 10),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.CHOICE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "CHOICE" as const,
                            options: [
                                {
                                    id: S.actionId(87, 10),
                                    order: 1,
                                    label: 'One-Handed',
                                    description: 'The drider deals 1d8 + 3 slashing damage.',
                                    resultBlock: {
                                        id: S.actionId(87, 10) + "__result",
                                        resultKind: "SINGLE" as const,
                                        outcomes: [
                                            {
                                                id: S.actionId(87, 10),
                                                effectKind: S.EFFECT_KIND.DAMAGE,
                                                damageTypeId: S.damageTypeId('SLASHING'),
                                                valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                                scalingKind: S.SCALING.NONE,
                                                diceConfig: '1d8+3'
                                            }
                                        ]
                                    }
                                }
                            ]
                        },
                        {
                            id: S.actionId(87, 11),
                            order: 2,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.CHOICE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "CHOICE" as const,
                            options: [
                                {
                                    id: S.actionId(87, 11),
                                    order: 1,
                                    label: 'Two-Handed',
                                    description: 'The drider deals 1d10 + 3 slashing damage when using the longsword with two hands.',
                                    resultBlock: {
                                        id: S.actionId(87, 11) + "__result",
                                        resultKind: "SINGLE" as const,
                                        outcomes: [
                                            {
                                                id: S.actionId(87, 11),
                                                effectKind: S.EFFECT_KIND.DAMAGE,
                                                damageTypeId: S.damageTypeId('SLASHING'),
                                                valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                                scalingKind: S.SCALING.NONE,
                                                diceConfig: '1d10+3'
                                            }
                                        ]
                                    }
                                }
                            ]
                        }
                    ]
                }
            ],
            order: 8
        },
        {
            id: S.featureId(87, 9),
            label: 'Longbow',
            description: 'Longbow. Ranged Weapon Attack: +6 to hit, range 150/600 ft., one target. Hit: 7 (1d8 + 3) piercing damage plus 4 (1d8) poison damage.',
            effects: [
                {
                    id: S.actionId(87, 12),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(87, 13),
                            rangeKind: S.RANGE_KIND.DISTANCE,
                            amount: 600,
                            unit: S.MEASUREMENT_UNIT_CODE.FEET
                        },
                        targeting: {
                            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
                            dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(87, 14),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(87, 14) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(87, 14),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d8+3'
                                    }
                                ]
                            }
                        },
                        {
                            id: S.actionId(87, 15),
                            order: 2,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(87, 15) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(87, 15),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('POISON'),
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
            order: 9
        }
    ]
};


