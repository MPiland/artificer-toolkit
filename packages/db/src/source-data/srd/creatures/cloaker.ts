import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const cloaker: CreatureAuthored = {
    id: S.CREATURE_IDS.CLOAKER,
    label: 'Cloaker',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.ABERRATION,
    size: S.SIZE_CODE.LARGE,
    alignmentId: '00000000-0000-0000-0001-000600000000',
    tags: ['hover'],
    abilityScores: {
        STRENGTH: 17,
        DEXTERITY: 15,
        CONSTITUTION: 12,
        INTELLIGENCE: 13,
        WISDOM: 12,
        CHARISMA: 14,
        SPELLCASTING: 0
    },
    armorClass: 14,
    armorClassNote: 'natural armor',
    hitPoints: 78,
    hitDice: '12d10+12',
    speeds: [...S.walk(10), ...S.fly(40)],
    proficiencies: [
        S.grantedSkillProficiency(9141, 1, 'STEALTH')
    ],
    damageResistances: ['psychic'],
    senses: ['darkvision 60 ft.'],
    passivePerception: 11,
    challengeRatingId: S.CR.CR_8,
    xp: 3900,
    features: [
        {
            id: S.featureId(65, 1),
            label: 'Damage Transfer',
            description: 'Damage Transfer. While attached to a creature, the cloaker takes only half the damage dealt to it (rounded down), and the creature it is attached to takes the other half.',
            order: 1
        },
        {
            id: S.featureId(65, 2),
            label: 'False Appearance',
            description: "False Appearance. While the cloaker remains motionless on a wall or ceiling, it is indistinguishable from a dark, leathery cloak.",
            order: 2
        },
        {
            id: S.featureId(65, 3),
            label: 'Light Sensitivity',
            description: 'Light Sensitivity. While in bright light, the cloaker has disadvantage on attack rolls and on Wisdom (Perception) checks that rely on sight.',
            order: 3
        },
        {
            id: S.featureId(65, 4),
            label: 'Moan',
            description: 'Moan. Each creature within 60 feet of the cloaker that can hear it must succeed on a DC 13 Wisdom saving throw or become frightened until the end of the cloaker\'s next turn.',
            order: 4
        },
        {
            id: S.featureId(65, 5),
            label: 'Phantasms',
            description: 'Phantasms. The cloaker creates illusory duplicates of itself while in dim light or darkness. The duplicates vanish when the cloaker leaves dim light or darkness, and the effect ends if the cloaker takes radiant damage.',
            order: 5
        },
        {
            id: S.featureId(65, 6),
            label: 'Multiattack',
            description: 'Multiattack. The cloaker makes two attacks: one with its bite and one with its tail.',
            order: 6
        },
        {
            id: S.featureId(65, 7),
            label: 'Bite',
            description: 'Bite. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) piercing damage.',
            effects: [
                {
                    id: S.actionId(9141, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(9141, 2),
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
                            id: S.actionId(9141, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(9141, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(9141, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d6',
                                        bonuses: [
                                            {
                                                id: S.actionId(9141, 4),
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
            order: 7
        },
        {
            id: S.featureId(65, 8),
            label: 'Tail',
            description: 'Tail. Melee Weapon Attack: +6 to hit, reach 10 ft., one target. Hit: 7 (1d8 + 3) bludgeoning damage.',
            effects: [
                {
                    id: S.actionId(9141, 5),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(9141, 6),
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
                            id: S.actionId(9141, 7),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(9141, 7) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(9141, 7),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d8',
                                        bonuses: [
                                            {
                                                id: S.actionId(9141, 8),
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
            order: 1
        }
    ]
};


