import { DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared';
import { conditionTypeId } from '../equipment/shared.js';
import * as S from './shared.js';
export const drow: CreatureAuthored = {
    id: S.CREATURE_IDS.DROW,
    label: 'Drow',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.HUMANOID,
    size: S.SIZE_CODE.MEDIUM,
    alignmentId: '00000000-0000-0000-0001-000800000000',
    tags: ['elf'],
    abilityScores: {
        STRENGTH: 10,
        DEXTERITY: 14,
        CONSTITUTION: 10,
        INTELLIGENCE: 11,
        WISDOM: 11,
        CHARISMA: 12,
    },
    armorClass: 15,
    armorClassNote: 'chain shirt',
    hitPoints: 13,
    hitDice: '3d8',
    speeds: [...S.walk(30)],
    proficiencies: [
        S.grantedSkillProficiency(88, 1, 'PERCEPTION', 'STEALTH'),
        S.grantedLanguageProficiency(88, 2, 'ELVISH', 'UNDERCOMMON')
    ],
    senses: ['darkvision 120 ft.'],
    passivePerception: 12,
    challengeRatingId: S.CR.CR_1_4,
    xp: 50,
    features: [
        {
            id: S.featureId(88, 1),
            label: 'Fey Ancestry',
            description: "Fey Ancestry. The drow has advantage on saving throws against being charmed, and magic can't put the drow to sleep.",
            order: 1
        },
        {
            id: S.featureId(88, 2),
            label: 'Innate Spellcasting',
            description: "Innate Spellcasting. The drow's spellcasting ability is Charisma (spell save DC 11). It can innately cast the following spells, requiring no material components: At will: dancing lights. 1/day each: darkness, faerie fire.",
            order: 3
        },
        {
            id: S.featureId(88, 3),
            label: 'Sunlight Sensitivity',
            description: 'Sunlight Sensitivity. While in sunlight, the drow has disadvantage on attack rolls, as well as on Wisdom (Perception) checks that rely on sight.',
            order: 4
        },
        {
            id: S.featureId(88, 4),
            label: 'Shortsword',
            description: 'Shortsword. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) piercing damage.',
            effects: [
                {
                    id: S.actionId(88, 1),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(88, 2),
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
                            id: S.actionId(88, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(88, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(88, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d6+2'
                                    }
                                ]
                            }
                        }
                    ]
                }
            ],
            order: 5
        },
        {
            id: S.featureId(88, 5),
            label: 'Hand Crossbow',
            description: 'Hand Crossbow. Ranged Weapon Attack: +4 to hit, range 30/120 ft., one target. Hit: 5 (1d6 + 2) piercing damage, and the target must succeed on a DC 13 Constitution saving throw or be poisoned for 1 hour. If the saving throw fails by 5 or more, the target is also unconscious while poisoned in this way. The target wakes up if it takes damage or if another creature takes an action to shake it awake.',
            effects: [
                {
                    id: S.actionId(88, 4),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(88, 5),
                            rangeKind: S.RANGE_KIND.DISTANCE,
                            amount: 120,
                            unit: S.MEASUREMENT_UNIT_CODE.FEET
                        },
                        targeting: {
                            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
                            dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(88, 6),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(88, 6) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(88, 6),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d6+2'
                                    }
                                ]
                            }
                        },
                        {
                            id: S.actionId(88, 7),
                            order: 2,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(88, 7) + "__result",
                                resultKind: "SEQUENCE" as const,
                                duration: {
                                    id: S.actionId(88, 8),
                                    durationKind: DURATION_KIND.HOUR,
                                    amount: 1
                                },
                                outcomes: [
                                    {
                                        id: S.actionId(88, 7),
                                        effectKind: S.EFFECT_KIND.CONDITION,
                                        conditionId: conditionTypeId('POISONED')
                                    }
                                ]
                            }
                        }
                    ]
                }
            ],
            order: 6
        }
    ]
};


