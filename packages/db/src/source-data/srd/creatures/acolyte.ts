import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const acolyte: CreatureAuthored = {
    id: S.CREATURE_IDS.ACOLYTE,
    label: 'Acolyte',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    category: S.CREATURE_CATEGORY_CODE.NPC,
    creatureTypeId: S.CREATURE_TYPE.HUMANOID,
    size: S.SIZE_CODE.MEDIUM,
    tags: ['any race'],
    abilityScores: {
        STRENGTH: 10,
        DEXTERITY: 10,
        CONSTITUTION: 10,
        INTELLIGENCE: 10,
        WISDOM: 14,
        CHARISMA: 11,
    },
    armorClass: 10,
    hitPoints: 9,
    hitDice: '2d8',
    speeds: [...S.walk(30)],
    proficiencies: [
        S.grantedSkillProficiency(2, 1, 'MEDICINE', 'RELIGION')
    ],
    passivePerception: 12,
    challengeRatingId: S.CR.CR_1_4,
    xp: 50,
    features: [
        {
            id: S.featureId(2, 1),
            label: 'Spellcasting',
            description: 'Spellcasting. The acolyte is a 1st-level spellcaster. Its spellcasting ability is Wisdom (spell save DC 12, +4 to hit with spell attacks). The acolyte has the following cleric spells prepared: Cantrips (at will): light, sacred flame, thaumaturgy. 1st level (3 slots): bless, cure wounds, sanctuary.',
            order: 1
        },
        {
            id: S.featureId(2, 2),
            label: 'Language Knowledge',
            description: 'Any one language (usually Common).',
            grants: {
                proficiencies: [
                    S.grantedLanguageProficiency(2, 2, 'COMMON')
                ]
            },
            order: 2
        },
        {
            id: S.featureId(2, 3),
            label: 'Club',
            description: 'Club. Melee Weapon Attack: +2 to hit, reach 5 ft., one target. Hit: 2 (1d4) bludgeoning damage.',
            effects: [
                {
                    id: S.actionId(2, 1),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(2, 2),
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
                            id: S.actionId(2, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(2, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(2, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d4'
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


