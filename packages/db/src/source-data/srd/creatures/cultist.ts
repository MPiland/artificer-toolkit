import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const cultist: CreatureAuthored = {
    id: S.CREATURE_IDS.CULTIST,
    label: 'Cultist',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    category: S.CREATURE_CATEGORY_CODE.NPC,
    creatureTypeId: S.CREATURE_TYPE.HUMANOID,
    size: S.SIZE_CODE.MEDIUM,
    tags: ['any race'],
    abilityScores: {
        STRENGTH: 11,
        DEXTERITY: 12,
        CONSTITUTION: 10,
        INTELLIGENCE: 10,
        WISDOM: 11,
        CHARISMA: 10,
    },
    armorClass: 12,
    armorClassNote: 'leather armor',
    hitPoints: 9,
    hitDice: '2d8',
    speeds: [...S.walk(30)],
    proficiencies: [
        S.grantedSkillProficiency(75, 1, 'DECEPTION', 'RELIGION')
    ],
    passivePerception: 10,
    challengeRatingId: S.CR.CR_1_8,
    xp: 25,
    features: [
        {
            id: S.featureId(75, 1),
            label: 'Dark Devotion',
            description: 'Dark Devotion. The cultist has advantage on saving throws against being charmed or frightened.',
            order: 1
        },
        {
            id: S.featureId(75, 2),
            label: 'Language Knowledge',
            description: 'Any one language (usually Common).',
            grants: {
                proficiencies: [
                    S.grantedLanguageProficiency(75, 2, 'COMMON')
                ]
            },
            order: 2
        },
        {
            id: S.featureId(75, 3),
            label: 'Scimitar',
            description: 'Melee Weapon Attack: +3 to hit, reach 5 ft., one creature. Hit: 4 (1d6 + 1) slashing damage.',
            effects: [
                {
                    id: S.actionId(75, 1),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                        range: {
                            id: S.actionId(75, 2),
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
                            id: S.actionId(75, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(75, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(75, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('SLASHING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d6',
                                        bonuses: [
                                            {
                                                id: S.actionId(75, 4),
                                                bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                                                ability: S.ABILITY_CODE.DEXTERITY,
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
        }
    ]
};


