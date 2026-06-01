import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const pegasus: CreatureAuthored = {
    id: S.CREATURE_IDS.PEGASUS,
    label: 'Pegasus',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.CELESTIAL,
    size: S.SIZE_CODE.LARGE,
    alignmentId: '00000000-0000-0000-0001-000300000000',
    abilityScores: {
        STRENGTH: 18,
        DEXTERITY: 15,
        CONSTITUTION: 16,
        INTELLIGENCE: 10,
        WISDOM: 15,
        CHARISMA: 13,
        SPELLCASTING: 0
    },
    armorClass: 12,
    hitPoints: 59,
    hitDice: '7d10+21',
    speeds: [...S.walk(60), ...S.fly(90)],
    proficiencies: [
        S.grantedSaveProficiency(217, 1, 'DEXTERITY', 'WISDOM', 'CHARISMA'),
        S.grantedSkillProficiency(217, 2, 'PERCEPTION')
    ],
    passivePerception: 16,
    features: [
        {
            id: S.featureId(217, 1),
            label: 'Understands Celestial, Common, Elvish, and Sylvan',
            description: "The pegasus understands Celestial, Common, Elvish, and Sylvan but can't speak.",
            grants: {
                proficiencies: [
                    S.grantedLanguageProficiency(217, 3, 'CELESTIAL', 'COMMON', 'ELVISH', 'SYLVAN')
                ]
            },
            order: 1
        },
        {
            id: S.featureId(217, 2),
            label: 'Hooves',
            description: 'Hooves. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 11 (2d6 + 4) bludgeoning damage.',
            effects: [
                {
                    id: S.actionId(217, 1),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(217, 2),
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
                            id: S.actionId(217, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(217, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(217, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d6',
                                        bonuses: [
                                            {
                                                id: S.actionId(217, 4),
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
            order: 2
        }
    ],
    challengeRatingId: S.CR.CR_2,
    xp: 450
};


