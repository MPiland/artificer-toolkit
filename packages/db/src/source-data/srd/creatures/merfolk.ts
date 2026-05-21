import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const merfolk: CreatureAuthored = {
    id: S.CREATURE_IDS.MERFOLK,
    label: 'Merfolk',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.HUMANOID,
    size: S.SIZE_CODE.MEDIUM,
    tags: ['merfolk'],
    abilityScores: {
        STRENGTH: 10,
        DEXTERITY: 13,
        CONSTITUTION: 12,
        INTELLIGENCE: 11,
        WISDOM: 11,
        CHARISMA: 12,
        SPELLCASTING: 0
    },
    armorClass: 11,
    hitPoints: 11,
    hitDice: '2d8+2',
    speeds: [...S.walk(10), ...S.swim(40)],
    proficiencies: [
        S.grantedSkillProficiency(195, 1, 'PERCEPTION'),
        S.grantedLanguageProficiency(195, 2, 'AQUAN', 'COMMON')
    ],
    passivePerception: 12,
    challengeRatingId: S.CR.CR_1_8,
    xp: 25,
    features: [
        {
            id: S.featureId(195, 1),
            label: 'Amphibious',
            description: 'Amphibious. The merfolk can breathe air and water.',
            order: 1
        },
        {
            id: S.featureId(195, 2),
            label: 'Spear',
            description: 'Spear. Melee or Ranged Weapon Attack: +2 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 3 (1d6) piercing damage, or 4 (1d8) piercing damage if used with two hands to make a melee attack.',
            effects: [
                {
                    id: S.actionId(195, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(195, 2),
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
                            id: S.actionId(195, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(195, 3) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(195, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d6'
                                    }
                                ]
                            }
                        }
                    ]
                },
                {
                    id: S.actionId(195, 4),
                    order: 2,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(195, 5),
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
                            id: S.actionId(195, 6),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(195, 6) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(195, 6),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d8'
                                    }
                                ]
                            }
                        }
                    ]
                },
                {
                    id: S.actionId(195, 7),
                    order: 3,
                    invocation: {
                        triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(195, 8),
                            rangeKind: S.RANGE_KIND.SPECIAL
                        },
                        targeting: {
                            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
                            dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(195, 9),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(195, 9) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(195, 9),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d6'
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


