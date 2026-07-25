import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const bronzeDragonWyrmling: CreatureAuthored = {
    id: S.CREATURE_IDS.BRONZE_DRAGON_WYRMLING,
    label: 'Bronze Dragon Wyrmling',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.DRAGON,
    size: S.SIZE_CODE.MEDIUM,
    alignmentId: '00000000-0000-0000-0001-000100000000',
    abilityScores: {
        STRENGTH: 17,
        DEXTERITY: 10,
        CONSTITUTION: 15,
        INTELLIGENCE: 12,
        WISDOM: 11,
        CHARISMA: 15,
    },
    armorClass: 17,
    armorClassNote: 'natural armor',
    hitPoints: 32,
    hitDice: {
      count: 5,
      die: 8,
      modifier: 10,
    },
    speeds: [...S.walk(30), ...S.fly(60), ...S.swim(30)],
    proficiencies: [
        S.grantedSaveProficiency(6062, 1, 'DEXTERITY', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
        S.grantedSkillProficiency(6062, 2, 'PERCEPTION', 'STEALTH'),
        S.grantedLanguageProficiency(6062, 3, 'DRACONIC')
    ],
    damageImmunities: ['lightning'],
    senses: ['blindsight 10 ft.', 'darkvision 60 ft.'],
    passivePerception: 14,
    challengeRatingId: S.CR.CR_2,
    xp: 450,
    features: [
        {
            id: S.featureId(54, 1),
            label: 'Amphibious',
            description: 'Amphibious. The dragon can breathe air and water.',
            order: 1
        },
        {
            id: S.featureId(54, 2),
            label: 'Bite',
            description: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 8 (1d10 + 3) piercing damage.',
            effects: [
                {
                    id: S.actionId(6062, 1),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(6062, 2),
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
                            id: S.actionId(6062, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(6062, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(6062, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d10',
                                        bonuses: [
                                            {
                                                id: S.actionId(6062, 4),
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
            order: 2
        },
        {
            id: S.featureId(54, 3),
            label: 'Breath Weapons (Recharge 5-6)',
            description: 'The dragon uses one of the following breath weapons.',
            effects: [
                {
                    id: S.actionId(6062, 5),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.SAVING_THROW,
                        savingThrow: {
                            id: S.actionId(6062, 6),
                            dcMethod: 'FIXED_DC',
                            ability: S.ABILITY_CODE.DEXTERITY,
                            baseDc: 12
                        },
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(6062, 7),
                            rangeKind: S.RANGE_KIND.SPECIAL
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(6062, 8),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_SAVE_FAIL,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(6062, 8) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(6062, 8),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('LIGHTNING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '3d10'
                                    }
                                ]
                            }
                        },
                        {
                            id: S.actionId(6062, 9),
                            order: 2,
                            pathCode: S.PATH_CODE.ON_SAVE_SUCCESS,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(6062, 9) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(6062, 9),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('LIGHTNING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '3d10',
                                        multiplier: 0.5
                                    }
                                ]
                            }
                        }
                    ]
                },
                {
                    id: S.actionId(6062, 10),
                    order: 2,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.SAVING_THROW,
                        savingThrow: {
                            id: S.actionId(6062, 11),
                            dcMethod: 'FIXED_DC',
                            ability: S.ABILITY_CODE.STRENGTH,
                            baseDc: 12
                        },
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(6062, 12),
                            rangeKind: S.RANGE_KIND.SPECIAL
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(6062, 13),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_SAVE_FAIL,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(6062, 13) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(6062, 13),
                                        effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION
                                    }
                                ]
                            }
                        }
                    ]
                }
            ],
            order: 3
        }
    ]
};


