import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const panther: CreatureAuthored = {
    id: S.CREATURE_IDS.PANTHER,
    label: 'Panther',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    category: S.CREATURE_CATEGORY_CODE.BEAST,
    creatureTypeId: S.CREATURE_TYPE.BEAST,
    size: S.SIZE_CODE.MEDIUM,
    alignmentId: '00000000-0000-0000-0001-000a00000000',
    abilityScores: {
        STRENGTH: 14,
        DEXTERITY: 15,
        CONSTITUTION: 10,
        INTELLIGENCE: 3,
        WISDOM: 14,
        CHARISMA: 7,
    },
    armorClass: 12,
    hitPoints: 13,
    hitDice: {
      count: 3,
      die: 8,
      modifier: 0,
    },
    speeds: [...S.walk(50), ...S.climb(40)],
    proficiencies: [
        S.grantedSkillProficiency(216, 1, 'PERCEPTION', 'STEALTH')
    ],
    passivePerception: 14,
    challengeRatingId: S.CR.CR_1_4,
    xp: 50,
    features: [
        {
            id: S.featureId(216, 1),
            label: 'Keen Smell',
            description: 'Keen Smell. The panther has advantage on Wisdom (Perception) checks that rely on smell.',
            order: 1
        },
        {
            id: S.featureId(216, 2),
            label: 'Pounce',
            description: 'Pounce. If the panther moves at least 20 feet straight toward a creature and then hits it with a claw attack on the same turn, that target must succeed on a DC 12 Strength saving throw or be knocked prone. If the target is prone, the panther can make one bite attack against it as a bonus action.',
            order: 2
        },
        {
            id: S.featureId(216, 3),
            label: 'Bite',
            description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) piercing damage.',
            effects: [
                {
                    id: S.actionId(216, 1),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(216, 2),
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
                            id: S.actionId(216, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(216, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(216, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d6',
                                        bonuses: [
                                            {
                                                id: S.actionId(216, 4),
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
            id: S.featureId(216, 4),
            label: 'Claw',
            description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 4 (1d4 + 2) slashing damage.',
            effects: [
                {
                    id: S.actionId(216, 5),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(216, 6),
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
                            id: S.actionId(216, 7),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(216, 7) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(216, 7),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('SLASHING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d4',
                                        bonuses: [
                                            {
                                                id: S.actionId(216, 8),
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
            order: 4
        }
    ]
};


