import type { CreatureAuthored } from '@artificer-toolkit/shared';
import { conditionTypeId } from '../equipment/shared.js';
import * as S from './shared.js';
export const roper: CreatureAuthored = {
    id: S.CREATURE_IDS.ROPER,
    label: 'Roper',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
    size: S.SIZE_CODE.LARGE,
    alignmentId: '00000000-0000-0000-0001-000800000000',
    abilityScores: {
        STRENGTH: 18,
        DEXTERITY: 8,
        CONSTITUTION: 17,
        INTELLIGENCE: 7,
        WISDOM: 16,
        CHARISMA: 6,
        SPELLCASTING: 0
    },
    armorClass: 20,
    armorClassNote: 'natural armor',
    hitPoints: 93,
    hitDice: '11d10+33',
    speeds: [...S.walk(10), ...S.climb(10)],
    proficiencies: [
        S.grantedSkillProficiency(7072, 1, 'PERCEPTION', 'STEALTH')
    ],
    senses: ['darkvision 60 ft.'],
    passivePerception: 16,
    challengeRatingId: S.CR.CR_5,
    xp: 1800,
    features: [
        {
            id: S.featureId(239, 1),
            label: 'False Appearance',
            description: 'False Appearance. While the roper remains motionless, it is indistinguishable from a normal stalagmite.',
            order: 1
        },
        {
            id: S.featureId(239, 2),
            label: 'Grasping Tendrils',
            description: 'Grasping Tendrils. The roper has six tendrils, each of which can be attacked (AC 20; 10 hit points; immunity to poison and psychic damage). Regaining hit points for a destroyed tendril does not restore it. A tendril can be severed by any source that deals 10 or more slashing damage to it in a single hit. A destroyed tendril regrows at the start of the roper\'s next turn.',
            order: 2
        },
        {
            id: S.featureId(239, 3),
            label: 'Spider Climb',
            description: 'Spider Climb. The roper can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.',
            order: 3
        },
        {
            id: S.featureId(239, 4),
            label: 'Multiattack',
            description: 'The roper makes four attacks with its tendrils, uses Reel, and makes one bite attack.',
            order: 4
        },
        {
            id: S.featureId(239, 5),
            label: 'Bite',
            description: 'Bite. Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 22 (4d8 + 4) piercing damage.',
            effects: [
                {
                    id: S.actionId(7072, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(7072, 2),
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
                            id: S.actionId(7072, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(7072, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(7072, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '4d8',
                                        bonuses: [
                                            {
                                                id: S.actionId(7072, 4),
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
            id: S.featureId(239, 6),
            label: 'Tendril',
            description: 'Tendril. Melee Weapon Attack: +7 to hit, reach 50 ft., one target. Hit: The target is grappled (escape DC 15) if it is a Large or smaller creature. Until the grapple ends, the target is restrained and has disadvantage on Strength checks and Strength saving throws, and the roper cannot use the same tendril on another target.',
            effects: [
                {
                    id: S.actionId(7072, 5),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(7072, 6),
                            rangeKind: S.RANGE_KIND.DISTANCE,
                            amount: 50,
                            unit: S.MEASUREMENT_UNIT_CODE.FEET
                        },
                        targeting: {
                            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
                            dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(7072, 7),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(7072, 7) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(7072, 7),
                                        effectKind: S.EFFECT_KIND.CONDITION,
                                        conditionId: conditionTypeId('GRAPPLED')
                                    }
                                ]
                            }
                        },
                        {
                            id: S.actionId(7072, 8),
                            order: 2,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(7072, 8) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(7072, 8),
                                        effectKind: S.EFFECT_KIND.CONDITION,
                                        conditionId: conditionTypeId('RESTRAINED')
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
            id: S.featureId(239, 7),
            label: 'Reel',
            description: 'Reel. The roper pulls each creature grappled by it up to 25 feet straight toward it.',
            effects: [
                {
                    id: S.actionId(7072, 9),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.ACTIVATED,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(7072, 10),
                            rangeKind: S.RANGE_KIND.SPECIAL
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(7072, 11),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_USE,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(7072, 11) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(7072, 11),
                                        effectKind: S.EFFECT_KIND.RULE
                                    }
                                ]
                            }
                        }
                    ]
                }
            ],
            order: 7
        }
    ]
};


