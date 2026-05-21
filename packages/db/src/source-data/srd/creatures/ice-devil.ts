import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const iceDevil: CreatureAuthored = {
    id: S.CREATURE_IDS.ICE_DEVIL,
    label: 'Ice Devil',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.FIEND,
    size: S.SIZE_CODE.LARGE,
    alignmentId: '00000000-0000-0000-0001-000700000000',
    abilityScores: {
        STRENGTH: 21,
        DEXTERITY: 14,
        CONSTITUTION: 18,
        INTELLIGENCE: 18,
        WISDOM: 15,
        CHARISMA: 18,
        SPELLCASTING: 0
    },
    armorClass: 18,
    armorClassNote: 'natural armor',
    hitPoints: 180,
    hitDice: '19d10+76',
    speeds: [...S.walk(40)],
    proficiencies: [
        S.grantedSaveProficiency(8846, 1, 'DEXTERITY', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
        S.grantedSkillProficiency(8846, 2, 'DECEPTION', 'INSIGHT', 'PERCEPTION', 'STEALTH'),
        S.grantedLanguageProficiency(8846, 3, 'INFERNAL')
    ],
    damageResistances: ['cold', 'bludgeoning, piercing, and slashing from nonmagical attacks that aren\'t silvered'],
    damageImmunities: ['fire', 'poison'],
    conditionImmunities: ['poisoned'],
    senses: ['blindsight 120 ft.'],
    passivePerception: 15,
    challengeRatingId: S.CR.CR_14,
    xp: 11500,
    features: [
        {
            id: S.featureId(171, 1),
            label: 'Devil\'s Sight',
            description: 'Devil\'s Sight. Magical darkness doesn\'t impede the devil\'s darkvision.',
            order: 1
        },
        {
            id: S.featureId(171, 2),
            label: 'Ice Walk',
            description: 'Ice Walk. The devil can move across and climb icy surfaces without needing to make an ability check. Additionally, difficult terrain composed of ice or snow doesn\'t cost it extra movement.',
            order: 2
        },
        {
            id: S.featureId(171, 3),
            label: 'Magic Resistance',
            description: 'Magic Resistance. The devil has advantage on saving throws against spells and other magical effects.',
            order: 3
        },
        {
            id: S.featureId(171, 4),
            label: 'Multiattack',
            description: 'The devil makes two attacks: one with its spear and one with its tail.',
            order: 4
        },
        {
            id: S.featureId(171, 5),
            label: 'Spear',
            description: 'Spear. Melee Weapon Attack: +9 to hit, reach 10 ft., one target. Hit: 12 (2d6 + 5) piercing damage plus 10 (3d6) cold damage.',
            effects: [
                {
                    id: S.actionId(8846, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                        range: {
                            id: S.actionId(8846, 2),
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
                            id: S.actionId(8846, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(8846, 3) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(8846, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d6',
                                        bonuses: [
                                            {
                                                id: S.actionId(8846, 4),
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
                            id: S.actionId(8846, 5),
                            order: 2,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(8846, 5) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(8846, 5),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('COLD'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '3d6'
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
            id: S.featureId(171, 6),
            label: 'Tail',
            description: 'Tail. Melee Weapon Attack: +9 to hit, reach 10 ft., one target. Hit: 16 (2d8 + 5) bludgeoning damage plus 10 (3d6) cold damage.',
            effects: [
                {
                    id: S.actionId(8846, 6),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                        range: {
                            id: S.actionId(8846, 7),
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
                            id: S.actionId(8846, 8),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(8846, 8) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(8846, 8),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d8',
                                        bonuses: [
                                            {
                                                id: S.actionId(8846, 9),
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
                            id: S.actionId(8846, 10),
                            order: 2,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(8846, 10) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(8846, 10),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('COLD'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '3d6'
                                    }
                                ]
                            }
                        }
                    ]
                }
            ],
            order: 6
        }
    ]
};


