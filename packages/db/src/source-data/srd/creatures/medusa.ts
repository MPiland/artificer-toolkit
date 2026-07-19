import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const medusa: CreatureAuthored = {
    id: S.CREATURE_IDS.MEDUSA,
    label: 'Medusa',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
    size: S.SIZE_CODE.MEDIUM,
    alignmentId: '00000000-0000-0000-0001-000700000000',
    abilityScores: {
        STRENGTH: 10,
        DEXTERITY: 15,
        CONSTITUTION: 16,
        INTELLIGENCE: 12,
        WISDOM: 13,
        CHARISMA: 15,
    },
    armorClass: 15,
    armorClassNote: 'natural armor',
    hitPoints: 127,
    hitDice: '17d8+51',
    speeds: [...S.walk(30)],
    proficiencies: [
        S.grantedSkillProficiency(194, 1, 'DECEPTION', 'INSIGHT', 'PERCEPTION', 'STEALTH'),
        S.grantedLanguageProficiency(194, 2, 'COMMON')
    ],
    challengeRatingId: S.CR.CR_6,
    xp: 2300,
    features: [
        {
            id: S.featureId(194, 1),
            label: 'Petrifying Gaze',
            description: 'Petrifying Gaze. When a creature that can see the medusa\'s eyes starts its turn within 30 feet of the medusa, the medusa can force it to make a DC 14 Constitution saving throw if the medusa isn\'t incapacitated and can see the creature. If the saving throw fails by 5 or more, the creature is instantly petrified. Otherwise, on a failed save, the creature is restrained and starts to turn to stone. The restrained creature must repeat the saving throw at the end of its next turn, becoming petrified on a failure or ending the effect on a success.',
            order: 1
        },
        {
            id: S.featureId(194, 2),
            label: 'Multiattack',
            description: 'The medusa makes either three melee attacks, one with its snake hair and two with its shortsword, or two ranged attacks with its longbow.',
            order: 2
        },
        {
            id: S.featureId(194, 3),
            label: 'Snake Hair',
            description: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one creature. Hit: 4 (1d4 + 2) piercing damage plus 14 (4d6) poison damage.',
            order: 3
        },
        {
            id: S.featureId(194, 4),
            label: 'Shortsword',
            description: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) piercing damage.',
            order: 4
        },
        {
            id: S.featureId(194, 5),
            label: 'Longbow',
            description: 'Ranged Weapon Attack: +5 to hit, range 150/600 ft., one target. Hit: 6 (1d8 + 2) piercing damage plus 7 (2d6) poison damage.',
            effects: [
                {
                    id: S.actionId(194, 10),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(194, 11),
                            rangeKind: S.RANGE_KIND.SPECIAL
                        },
                        targeting: {
                            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
                            dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(194, 12),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(194, 12) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(194, 12),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d8',
                                        bonuses: [
                                            {
                                                id: S.actionId(194, 13),
                                                bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                                                ability: S.ABILITY_CODE.DEXTERITY,
                                                order: 1
                                            }
                                        ]
                                    }
                                ]
                            }
                        },
                        {
                            id: S.actionId(194, 14),
                            order: 2,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(194, 14) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(194, 14),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('POISON'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d6'
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


