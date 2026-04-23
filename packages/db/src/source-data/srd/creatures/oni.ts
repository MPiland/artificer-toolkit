import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const oni: CreatureAuthored = {
    id: S.CREATURE_IDS.ONI,
    label: 'Oni',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.GIANT,
    size: S.SIZE_CODE.LARGE,
    alignmentId: '00000000-0000-0000-0001-000800000000',
    abilityScores: {
        STRENGTH: 19,
        DEXTERITY: 11,
        CONSTITUTION: 16,
        INTELLIGENCE: 14,
        WISDOM: 12,
        CHARISMA: 15,
        SPELLCASTING: 0
    },
    armorClass: 16,
    armorClassNote: 'chain mail',
    hitPoints: 110,
    hitDice: '13d10+39',
    speeds: [...S.walk(30), ...S.fly(30)],
    proficiencies: [
        S.grantedSkillProficiency(3186, 1, 'ARCANA', 'DECEPTION', 'PERCEPTION'),
        S.grantedLanguageProficiency(3186, 2, 'COMMON', 'GIANT', 'INFERNAL')
    ],
    damageResistances: ['cold'],
    senses: ['darkvision 120 ft.'],
    passivePerception: 13,
    challengeRatingId: S.CR.CR_7,
    xp: 2900,
    features: [
        {
            id: S.featureId(3186, 1),
            label: 'Darkness Aura',
            description: 'Darkness Aura. Magical darkness surrounds the oni in dim light or darkness. A creature with darkvision can see through this darkness only if its darkvision can penetrate magical darkness.',
            order: 1
        },
        {
            id: S.featureId(3186, 2),
            label: 'Innate Spellcasting',
            description: "Innate Spellcasting. The oni's innate spellcasting ability is Charisma (spell save DC 13, +5 to hit with spell attacks). The oni can innately cast the following spells, requiring no material components: At will: darkness, invisibility. 1/day each: cone of cold, gaseous form, sleep.",
            order: 2
        },
        {
            id: S.featureId(3186, 3),
            label: 'Regeneration',
            description: 'Regeneration. The oni regains 10 hit points at the start of its turn if it has at least 1 hit point and is in dim light or darkness. The oni dies only if it starts its turn with 0 hit points and does not regenerate.',
            order: 3
        },
        {
            id: S.featureId(3186, 4),
            label: 'Shapechanger',
            description: "Shapechanger. The oni magically polymorphs into a Small or Medium humanoid, or back into its true form. Its statistics are the same in each form. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.",
            order: 4
        },
        {
            id: S.featureId(3186, 5),
            label: 'Multiattack',
            description: 'Multiattack. The oni makes two attacks, only one of which can be with its bite.',
            order: 5
        },
        {
            id: S.featureId(3186, 6),
            label: 'Claw',
            description: 'Claw. Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) slashing damage.',
            effects: [
                {
                    id: S.actionId(3186, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(3186, 2),
                            rangeKind: S.RANGE_KIND.DISTANCE,
                            amount: 5,
                            unit: S.MEASUREMENT_UNIT_CODE.FEET
                        },
                        targeting: {
                            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(3186, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(3186, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(3186, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('SLASHING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d6',
                                        bonuses: [
                                            {
                                                id: S.actionId(3186, 4),
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
            order: 6
        },
        {
            id: S.featureId(3186, 7),
            label: 'Bite',
            description: 'Bite. Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 7 (1d6 + 3) piercing damage plus 7 (2d6) cold damage.',
            effects: [
                {
                    id: S.actionId(3186, 5),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(3186, 6),
                            rangeKind: S.RANGE_KIND.DISTANCE,
                            amount: 5,
                            unit: S.MEASUREMENT_UNIT_CODE.FEET
                        },
                        targeting: {
                            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(3186, 7),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(3186, 7) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(3186, 7),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d6',
                                        bonuses: [
                                            {
                                                id: S.actionId(3186, 8),
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
                            id: S.actionId(3186, 9),
                            order: 2,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(3186, 9) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(3186, 9),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('COLD'),
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
            order: 7
        }
    ]
};


