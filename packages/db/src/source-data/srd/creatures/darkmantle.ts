import type { CreatureAuthored } from '@artificer-toolkit/shared';
import { conditionTypeId } from '../equipment/shared.js';
import * as S from './shared.js';
export const darkmantle: CreatureAuthored = {
    id: S.CREATURE_IDS.DARKMANTLE,
    label: 'Darkmantle',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.ABERRATION,
    size: S.SIZE_CODE.SMALL,
    alignmentId: '00000000-0000-0000-0001-000a00000000',
    abilityScores: {
        STRENGTH: 16,
        DEXTERITY: 12,
        CONSTITUTION: 13,
        INTELLIGENCE: 2,
        WISDOM: 10,
        CHARISMA: 5,
    },
    armorClass: 11,
    armorClassNote: 'natural armor',
    hitPoints: 22,
    hitDice: {
      count: 5,
      die: 6,
      modifier: 5,
    },
    speeds: [...S.walk(10), ...S.fly(30)],
    proficiencies: [
        S.grantedSkillProficiency(6527, 1, 'STEALTH')
    ],
    senses: ['blindsight 60 ft.'],
    passivePerception: 10,
    challengeRatingId: S.CR.CR_1_2,
    xp: 100,
    features: [
        {
            id: S.featureId(76, 1),
            label: 'Echolocation',
            description: "Echolocation. The darkmantle can't use its blindsight while deafened.",
            order: 1
        },
        {
            id: S.featureId(76, 2),
            label: 'False Appearance',
            description: 'False Appearance. While the darkmantle remains motionless, it is indistinguishable from a cave formation such as a stalactite or stalagmite.',
            order: 2
        },
        {
            id: S.featureId(76, 3),
            label: 'Light Sensitivity',
            description: 'Light Sensitivity. While in bright light, the darkmantle has disadvantage on attack rolls and on Wisdom (Perception) checks that rely on sight.',
            order: 3
        },
        {
            id: S.featureId(76, 4),
            label: 'Crush',
            description: 'Crush. Melee Weapon Attack: +5 to hit, reach 5 ft., one creature. Hit: 6 (1d6 + 3) bludgeoning damage, and the darkmantle attaches to the target. While attached, the darkmantle occupies the target\'s space, and the target is blinded and unable to breathe.',
            effects: [
                {
                    id: S.actionId(6527, 1),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(6527, 2),
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
                            id: S.actionId(6527, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(6527, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(6527, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d6',
                                        bonuses: [
                                            {
                                                id: S.actionId(6527, 4),
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
                            id: S.actionId(6527, 5),
                            order: 2,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(6527, 5) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(6527, 5),
                                        effectKind: S.EFFECT_KIND.CONDITION,
                                        conditionId: conditionTypeId('BLINDED')
                                    }
                                ]
                            }
                        },
                        {
                            id: S.actionId(6527, 6),
                            order: 3,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(6527, 6) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(6527, 6),
                                        effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION
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
            id: S.featureId(76, 5),
            label: 'Darkness Aura (1/Day)',
            description: 'Darkness Aura (1/Day). As a bonus action, the darkmantle magically emits magical darkness in a 15-foot radius around itself, which moves with it and lasts for 10 minutes, requiring no concentration. The darkness is dispelled early if the darkmantle dies. A creature with darkvision can\'t see through this darkness, and nonmagical light can\'t illuminate it.',
            effects: [
                {
                    id: S.actionId(6527, 7),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.ACTIVATED,
                        activation: {
                            code: S.ACTIVATION_CODE.BONUS_ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(6527, 8),
                            rangeKind: S.RANGE_KIND.SPECIAL
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(6527, 9),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_USE,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(6527, 9) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(6527, 9),
                                        effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION
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


