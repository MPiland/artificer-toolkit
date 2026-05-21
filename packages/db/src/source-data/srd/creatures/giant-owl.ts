import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const giantOwl: CreatureAuthored = {
    id: S.CREATURE_IDS.GIANT_OWL,
    label: 'Giant Owl',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.BEAST,
    creatureTypeId: S.CREATURE_TYPE.BEAST,
    size: S.SIZE_CODE.LARGE,
    abilityScores: {
        STRENGTH: 13,
        DEXTERITY: 15,
        CONSTITUTION: 12,
        INTELLIGENCE: 8,
        WISDOM: 13,
        CHARISMA: 10,
        SPELLCASTING: 0
    },
    armorClass: 12,
    hitPoints: 19,
    hitDice: '3d10+3',
    speeds: [...S.walk(5), ...S.fly(60)],
    proficiencies: [
        S.grantedSkillProficiency(129, 1, 'PERCEPTION', 'STEALTH'),
        S.grantedLanguageProficiency(129, 2, 'GIANT_OWL', 'ELVISH')
    ],
    senses: ['darkvision 120 ft.'],
    passivePerception: 15,
    challengeRatingId: S.CR.CR_1_4,
    xp: 50,
    features: [
        {
            id: S.featureId(129, 1),
            label: 'Flyby',
            description: "Flyby. The owl doesn't provoke opportunity attacks when it flies out of an enemy's reach.",
            order: 1
        },
        {
            id: S.featureId(129, 2),
            label: 'Keen Hearing and Sight',
            description: 'Keen Hearing and Sight. The owl has advantage on Wisdom (Perception) checks that rely on hearing or sight.',
            order: 2
        },
        {
            id: S.featureId(129, 3),
            label: 'Language Limitation',
            description: 'Understands Common.',
            grants: {
                proficiencies: [
                    S.grantedLanguageProficiency(129, 3, 'COMMON')
                ]
            },
            order: 3
        },
        {
            id: S.featureId(129, 4),
            label: 'Talons',
            description: 'Talons. Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 8 (2d6 + 1) slashing damage.',
            effects: [
                {
                    id: S.actionId(129, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(129, 2),
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
                            id: S.actionId(129, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(129, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(129, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('SLASHING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d6+1'
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


