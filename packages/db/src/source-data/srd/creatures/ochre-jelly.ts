import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const ochreJelly: CreatureAuthored = {
    id: S.CREATURE_IDS.OCHRE_JELLY,
    label: 'Ochre Jelly',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.OOZE,
    size: S.SIZE_CODE.LARGE,
    alignmentId: '00000000-0000-0000-0001-000a00000000',
    abilityScores: {
        STRENGTH: 15,
        DEXTERITY: 6,
        CONSTITUTION: 14,
        INTELLIGENCE: 2,
        WISDOM: 6,
        CHARISMA: 1,
        SPELLCASTING: 0
    },
    armorClass: 8,
    hitPoints: 45,
    hitDice: '6d10+12',
    speeds: [...S.walk(10), ...S.climb(10)],
    damageResistances: ['acid'],
    damageImmunities: ['lightning', 'slashing'],
    conditionImmunities: ['blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'prone'],
    senses: ['blindsight 60 ft. (blind beyond this radius)'],
    passivePerception: 8,
    challengeRatingId: S.CR.CR_2,
    xp: 450,
    features: [
        {
            id: S.featureId(1864, 1),
            label: 'Amorphous',
            description: 'Amorphous. The jelly can move through a space as narrow as 1 inch wide without squeezing.',
            order: 1
        },
        {
            id: S.featureId(1864, 2),
            label: 'Spider Climb',
            description: 'Spider Climb. The jelly can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check.',
            order: 2
        },
        {
            id: S.featureId(1864, 3),
            label: 'Pseudopod',
            description: 'Pseudopod. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 9 (2d6 + 2) bludgeoning damage plus 3 (1d6) acid damage.',
            effects: [
                {
                    id: S.actionId(1864, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(1864, 2),
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
                            id: S.actionId(1864, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(1864, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(1864, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d6',
                                        bonuses: [
                                            {
                                                id: S.actionId(1864, 4),
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
                            id: S.actionId(1864, 5),
                            order: 2,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(1864, 5) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(1864, 5),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('ACID'),
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
            order: 3
        },
        {
            id: S.featureId(1864, 4),
            label: 'Split',
            description: 'Split. When a jelly that is Medium or larger is subjected to lightning or slashing damage, it splits into two new jellies if it has at least 10 hit points. Each new jelly has hit points equal to half the original jelly\'s, rounded down. New jellies are one size smaller than the original jelly.',
            effects: [
                {
                    id: S.reactionId(1864, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.ACTIVATED,
                        activation: {
                            code: S.ACTIVATION_CODE.REACTION,
                            amount: 1
                        },
                        range: {
                            id: S.reactionId(1864, 2),
                            rangeKind: S.RANGE_KIND.SPECIAL
                        }
                    },
                    paths: [
                        {
                            id: S.reactionId(1864, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_USE,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.reactionId(1864, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.reactionId(1864, 3),
                                        effectKind: S.EFFECT_KIND.RULE
                                    }
                                ]
                            }
                        }
                    ]
                }
            ],
            order: 4
        }
    ]
};


