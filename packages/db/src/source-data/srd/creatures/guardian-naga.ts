import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const guardianNaga: CreatureAuthored = {
    id: S.CREATURE_IDS.GUARDIAN_NAGA,
    label: 'Guardian Naga',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
    size: S.SIZE_CODE.LARGE,
    alignmentId: '00000000-0000-0000-0001-000100000000',
    abilityScores: {
        STRENGTH: 19,
        DEXTERITY: 18,
        CONSTITUTION: 16,
        INTELLIGENCE: 16,
        WISDOM: 19,
        CHARISMA: 18,
        SPELLCASTING: 0
    },
    armorClass: 18,
    armorClassNote: 'natural armor',
    hitPoints: 127,
    hitDice: '15d10+45',
    speeds: [...S.walk(40)],
    proficiencies: [
        S.grantedSaveProficiency(156, 1, 'DEXTERITY', 'CONSTITUTION', 'INTELLIGENCE', 'WISDOM', 'CHARISMA'),
        S.grantedLanguageProficiency(156, 2, 'CELESTIAL', 'COMMON')
    ],
    damageImmunities: ['poison'],
    conditionImmunities: ['charmed', 'poisoned'],
    senses: ['darkvision 60 ft.'],
    passivePerception: 14,
    challengeRatingId: S.CR.CR_10,
    xp: 5900,
    features: [
        {
            id: S.featureId(156, 1),
            label: 'Rejuvenation',
            description: 'Rejuvenation. If it dies, the naga returns to life in 1d6 days and regains all its hit points. Only a wish spell can prevent this trait from functioning.',
            order: 1
        },
        {
            id: S.featureId(156, 2),
            label: 'Spellcasting',
            description: 'Spellcasting. The naga is an 11th-level spellcaster. Its spellcasting ability is Wisdom (spell save DC 16, +8 to hit with spell attacks), and it needs only verbal components to cast its spells. It has the following cleric spells prepared: Cantrips (at will): mending, sacred flame, thaumaturgy. 1st level (4 slots): command, cure wounds, shield of faith. 2nd level (3 slots): calm emotions, hold person. 3rd level (3 slots): bestow curse, clairvoyance. 4th level (3 slots): banishment, freedom of movement. 5th level (2 slots): flame strike, geas. 6th level (1 slot): true seeing.',
            order: 2
        },
        {
            id: S.featureId(156, 3),
            label: 'Bite',
            description: 'Bite. Melee Weapon Attack: +8 to hit, reach 10 ft., one creature. Hit: 8 (1d8 + 4) piercing damage, and the target must make a DC 15 Constitution saving throw, taking 45 (10d8) poison damage on a failed save, or half as much damage on a successful one.',
            effects: [
                {
                    id: S.actionId(156, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(156, 2),
                            rangeKind: S.RANGE_KIND.DISTANCE,
                            amount: 10,
                            unit: S.MEASUREMENT_UNIT_CODE.FEET
                        },
                        targeting: {
                            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(156, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(156, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(156, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d8+4'
                                    }
                                ]
                            }
                        },
                        {
                            id: S.actionId(156, 4),
                            order: 2,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(156, 4) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(156, 4),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('POISON'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '10d8',
                                        multiplier: 0.5
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
            id: S.featureId(156, 4),
            label: 'Spit Poison',
            description: 'Spit Poison. Ranged Weapon Attack: +8 to hit, range 15/30 ft., one creature. Hit: The target must make a DC 15 Constitution saving throw, taking 45 (10d8) poison damage on a failed save, or half as much damage on a successful one.',
            effects: [
                {
                    id: S.actionId(156, 5),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(156, 6),
                            rangeKind: S.RANGE_KIND.DISTANCE,
                            amount: 30,
                            unit: S.MEASUREMENT_UNIT_CODE.FEET
                        },
                        targeting: {
                            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(156, 7),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(156, 7) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(156, 7),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('POISON'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '10d8',
                                        multiplier: 0.5
                                    }
                                ]
                            }
                        }
                    ]
                }
            ],
            order: 4
        }
    ],
};


