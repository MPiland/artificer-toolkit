import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const djinni: CreatureAuthored = {
    id: S.CREATURE_IDS.DJINNI,
    label: 'Djinni',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.ELEMENTAL,
    size: S.SIZE_CODE.LARGE,
    alignmentId: '00000000-0000-0000-0001-000300000000',
    abilityScores: {
        STRENGTH: 21,
        DEXTERITY: 15,
        CONSTITUTION: 22,
        INTELLIGENCE: 15,
        WISDOM: 16,
        CHARISMA: 20,
    },
    armorClass: 17,
    armorClassNote: 'natural armor',
    hitPoints: 161,
    hitDice: '14d10+84',
    speeds: [...S.walk(30), ...S.fly(90)],
    proficiencies: [
        S.grantedSaveProficiency(2690, 1, 'DEXTERITY', 'WISDOM', 'CHARISMA'),
        S.grantedLanguageProficiency(2690, 2, 'AURAN')
    ],
    damageImmunities: ['lightning', 'thunder'],
    senses: ['darkvision 120 ft.'],
    passivePerception: 13,
    challengeRatingId: S.CR.CR_11,
    xp: 7200,
    features: [
        {
            id: S.featureId(82, 1),
            label: 'Elemental Demise',
            description: 'Elemental Demise. If the djinni dies, its body disintegrates into a warm breeze, leaving behind only equipment the djinni was wearing or carrying.',
            order: 1
        },
        {
            id: S.featureId(82, 2),
            label: 'Innate Spellcasting',
            description: "Innate Spellcasting. The djinni's innate spellcasting ability is Charisma (spell save DC 17, +9 to hit with spell attacks). It can innately cast the following spells, requiring no material components: At will: detect evil and good, detect magic, thunderwave. 3/day each: create food and water (can create wine instead of water), tongues, wind walk. 1/day each: conjure elemental (air elemental only), creation, gaseous form, invisibility, major image, plane shift.",
            order: 2
        },
        {
            id: S.featureId(82, 3),
            label: 'Multiattack',
            description: 'Multiattack. The djinni makes three scimitar attacks.',
            order: 3
        },
        {
            id: S.featureId(82, 4),
            label: 'Scimitar',
            description: "Scimitar. Melee Weapon Attack: +9 to hit, reach 5 ft., one target. Hit: 12 (2d6 + 5) slashing damage plus 3 (1d6) lightning or thunder damage (djinni's choice).",
            effects: [
                {
                    id: S.actionId(2690, 1),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(2690, 2),
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
                            id: S.actionId(2690, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(2690, 3) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(2690, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('SLASHING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d6',
                                        bonuses: [
                                            {
                                                id: S.actionId(2690, 4),
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
                            id: S.actionId(2690, 5),
                            order: 2,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(2690, 5) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(2690, 5),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('LIGHTNING'),
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
            order: 4
        },
        {
            id: S.featureId(82, 6),
            label: 'Create Whirlwind',
            description: 'Create Whirlwind. A 5-foot-radius, 30-foot-tall cylinder of swirling air magically forms on a point the djinni can see within 120 feet of it. The whirlwind lasts as long as the djinni maintains concentration, as if concentrating on a spell. Any creature but the djinni that enters the whirlwind must succeed on a DC 18 Strength saving throw or be restrained by it. The djinni can move the whirlwind up to 60 feet as an action, and creatures restrained by the whirlwind move with it. The whirlwind ends if the djinni loses sight of it. A creature can use its action to free a creature restrained by the whirlwind, including itself, by succeeding on a DC 18 Strength check. If the check succeeds, the creature is no longer restrained and moves to the nearest space outside the whirlwind.',
            order: 5
        }
    ]
};


