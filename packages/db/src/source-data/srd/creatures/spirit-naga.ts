import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const spiritNaga: CreatureAuthored = {
    id: S.CREATURE_IDS.SPIRIT_NAGA,
    label: 'Spirit Naga',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
    size: S.SIZE_CODE.LARGE,
    alignmentId: '00000000-0000-0000-0001-000900000000',
    abilityScores: {
        STRENGTH: 18,
        DEXTERITY: 17,
        CONSTITUTION: 14,
        INTELLIGENCE: 16,
        WISDOM: 15,
        CHARISMA: 16,
        SPELLCASTING: 0
    },
    armorClass: 15,
    armorClassNote: 'natural armor',
    hitPoints: 75,
    hitDice: '10d10+20',
    speeds: [...S.walk(40)],
    proficiencies: [
        S.grantedSaveProficiency(259, 1, 'DEXTERITY', 'CONSTITUTION', 'WISDOM', 'CHARISMA'),
        S.grantedLanguageProficiency(259, 2, 'ABYSSAL', 'COMMON')
    ],
    damageImmunities: ['poison'],
    conditionImmunities: ['charmed', 'poisoned'],
    senses: ['darkvision 60 ft.'],
    passivePerception: 12,
    challengeRatingId: S.CR.CR_8,
    xp: 3900,
    features: [
        {
            id: S.featureId(259, 1),
            label: 'Rejuvenation',
            description: 'Rejuvenation. If it dies, the naga returns to life in 1d6 days and regains all its hit points. Only a wish spell can prevent this trait from functioning.',
            order: 1
        },
        {
            id: S.featureId(259, 2),
            label: 'Spellcasting',
            description: 'Spellcasting. The naga is a 10th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 14, +6 to hit with spell attacks). It has the following wizard spells prepared: Cantrips (at will): mage hand, minor illusion, ray of frost. 1st level (4 slots): charm person, detect magic, sleep. 2nd level (3 slots): detect thoughts, hold person. 3rd level (3 slots): lightning bolt, water breathing. 4th level (3 slots): blight, dimension door. 5th level (2 slots): dominate person.',
            order: 2
        },
        {
            id: S.featureId(259, 3),
            label: 'Bite',
            description: 'Bite. Melee Weapon Attack: +7 to hit, reach 10 ft., one creature. Hit: 7 (1d6 + 4) piercing damage, and the target must make a DC 13 Constitution saving throw, taking 31 (7d8) poison damage on a failed save, or half as much damage on a successful one.',
            effects: [
                {
                    id: S.actionId(259, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(259, 2),
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
                            id: S.actionId(259, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(259, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(259, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d6',
                                        bonuses: [
                                            {
                                                id: S.actionId(259, 4),
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
                            id: S.actionId(259, 5),
                            order: 2,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(259, 5) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(259, 5),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('POISON'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '7d8',
                                        multiplier: 0.5
                                    }
                                ]
                            }
                        }
                    ]
                }
            ],
            order: 3
        }
    ],
};


