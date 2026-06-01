import type { CreatureAuthored } from '@artificer-toolkit/shared';
import { conditionTypeId } from '../equipment/shared.js';
import * as S from './shared.js';
export const aboleth: CreatureAuthored = {
    id: S.CREATURE_IDS.ABOLETH,
    label: 'Aboleth',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.ABERRATION,
    size: S.SIZE_CODE.LARGE,
    alignmentId: '00000000-0000-0000-0001-000700000000',
    abilityScores: {
        STRENGTH: 21,
        DEXTERITY: 9,
        CONSTITUTION: 15,
        INTELLIGENCE: 18,
        WISDOM: 15,
        CHARISMA: 18,
        SPELLCASTING: 0
    },
    armorClass: 17,
    armorClassNote: 'natural armor',
    hitPoints: 135,
    hitDice: '18d10+36',
    speeds: [...S.walk(10), ...S.swim(40)],
    proficiencies: [
        S.grantedSaveProficiency(1, 1, 'CONSTITUTION', 'INTELLIGENCE', 'WISDOM'),
        S.grantedSkillProficiency(1, 2, 'HISTORY', 'PERCEPTION'),
        S.grantedLanguageProficiency(1, 3, 'DEEP_SPEECH')
    ],
    senses: ['darkvision 120 ft.'],
    passivePerception: 20,
    challengeRatingId: S.CR.CR_10,
    xp: 5900,
    features: [
        {
            id: S.featureId(1, 1),
            label: 'Amphibious',
            description: 'Amphibious. The aboleth can breathe air and water.',
            order: 1
        },
        {
            id: S.featureId(1, 2),
            label: 'Mucous Cloud',
            description: 'Mucous Cloud. While underwater, the aboleth is surrounded by transformative mucus. A creature that touches the aboleth or that hits it with a melee attack while within 5 feet of it must make a DC 14 Constitution saving throw. On a failure, the creature is diseased for 1d4 hours. The diseased creature can breathe only underwater.',
            order: 2
        },
        {
            id: S.featureId(1, 3),
            label: 'Probing Telepathy',
            description: "Probing Telepathy. If a creature communicates telepathically with the aboleth, the aboleth learns the creature's greatest desires if the aboleth can see the creature.",
            order: 3
        },
        {
            id: S.featureId(1, 4),
            label: 'Telepathy',
            description: 'Telepathy 120 ft.',
            order: 4
        },
        {
            id: S.featureId(1, 5),
            label: 'Multiattack',
            description: 'The aboleth makes three tentacle attacks.',
            effects: [
                {
                    id: S.legendaryActionId(1, 14),
                    order: 2,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.ACTIVATED,
                        activation: {
                            code: S.ACTIVATION_CODE.FREE
                        },
                        range: {
                            id: S.legendaryActionId(1, 15),
                            rangeKind: S.RANGE_KIND.SPECIAL
                        }
                    },
                    paths: [
                        {
                            id: S.legendaryActionId(1, 16),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_USE,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.legendaryActionId(1, 16) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.legendaryActionId(1, 16),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '3d6',
                                        bonuses: [
                                            {
                                                id: S.legendaryActionId(1, 20),
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
                    id: S.legendaryActionId(1, 17),
                    order: 3,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.ACTIVATED,
                        activation: {
                            code: S.ACTIVATION_CODE.FREE
                        },
                        range: {
                            id: S.legendaryActionId(1, 18),
                            rangeKind: S.RANGE_KIND.SPECIAL
                        }
                    },
                    paths: [
                        {
                            id: S.legendaryActionId(1, 19),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_USE,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.legendaryActionId(1, 19) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.legendaryActionId(1, 19),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PSYCHIC'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '3d6'
                                    }
                                ]
                            }
                        },
                        {
                            id: S.legendaryActionId(1, 21),
                            order: 2,
                            pathCode: S.PATH_CODE.ON_USE,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.legendaryActionId(1, 21) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.legendaryActionId(1, 21),
                                        effectKind: S.EFFECT_KIND.HEAL,
                                        valueKind: 'DICE',
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '3d6'
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


