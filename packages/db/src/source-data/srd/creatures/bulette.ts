import type { CreatureAuthored } from '@artificer-toolkit/shared';
import { conditionTypeId } from '../equipment/shared.js';
import * as S from './shared.js';
export const bulette: CreatureAuthored = {
    id: S.CREATURE_IDS.BULETTE,
    label: 'Bulette',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
    size: S.SIZE_CODE.LARGE,
    alignmentId: '00000000-0000-0000-0001-000a00000000',
    abilityScores: {
        STRENGTH: 19,
        DEXTERITY: 11,
        CONSTITUTION: 21,
        INTELLIGENCE: 2,
        WISDOM: 10,
        CHARISMA: 5,
    },
    armorClass: 17,
    armorClassNote: 'natural armor',
    hitPoints: 94,
    hitDice: {
      count: 9,
      die: 10,
      modifier: 45,
    },
    speeds: [...S.walk(40), ...S.burrow(40)],
    proficiencies: [
        S.grantedSkillProficiency(9521, 1, 'PERCEPTION')
    ],
    senses: ['darkvision 60 ft.', 'tremorsense 60 ft.'],
    passivePerception: 16,
    challengeRatingId: S.CR.CR_5,
    xp: 1800,
    features: [
        {
            id: S.featureId(57, 1),
            label: 'Standing Leap',
            description: "Standing Leap. The bulette's long jump is up to 30 feet and its high jump is up to 15 feet, with or without a running start.",
            order: 1
        },
        {
            id: S.featureId(57, 2),
            label: 'Deadly Leap',
            description: 'Deadly Leap. If the bulette jumps at least 15 feet as part of its movement, it can then use this action to land on its feet in a space that contains one or more other creatures. Each of those creatures must succeed on a DC 16 Dexterity saving throw or take 14 (3d6 + 4) bludgeoning damage and be knocked prone. On a successful save, the creature takes half the damage and isn\'t knocked prone.',
            effects: [
                {
                    id: S.actionId(9521, 1),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.ACTIVATED,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(9521, 2),
                            rangeKind: S.RANGE_KIND.SPECIAL
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(9521, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_USE,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(9521, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(9521, 3),
                                        effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION
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
            id: S.featureId(57, 3),
            label: 'Bite',
            description: 'Bite. Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 30 (4d12 + 4) piercing damage.',
            effects: [
                {
                    id: S.actionId(9521, 4),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(9521, 5),
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
                            id: S.actionId(9521, 6),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(9521, 6) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(9521, 6),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '4d12',
                                        bonuses: [
                                            {
                                                id: S.actionId(9521, 7),
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
            id: S.featureId(57, 4),
            label: 'Knock Prone',
            description: 'If the target of the bulette\'s bite is a Large or smaller creature, it must succeed on a DC 16 Strength saving throw or be knocked prone.',
            effects: [
                {
                    id: S.actionId(9521, 8),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.ACTIVATED,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(9521, 9),
                            rangeKind: S.RANGE_KIND.SPECIAL
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(9521, 10),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_USE,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(9521, 10) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(9521, 10),
                                        effectKind: S.EFFECT_KIND.CONDITION,
                                        conditionId: conditionTypeId('PRONE')
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


