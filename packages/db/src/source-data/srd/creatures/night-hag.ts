import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const nightHag: CreatureAuthored = {
    id: S.CREATURE_IDS.NIGHT_HAG,
    label: 'Night Hag',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.FIEND,
    size: S.SIZE_CODE.MEDIUM,
    alignmentId: '00000000-0000-0000-0001-000800000000',
    abilityScores: {
        STRENGTH: 18,
        DEXTERITY: 15,
        CONSTITUTION: 16,
        INTELLIGENCE: 16,
        WISDOM: 14,
        CHARISMA: 16,
    },
    armorClass: 17,
    armorClassNote: 'natural armor',
    hitPoints: 112,
    hitDice: '15d8+45',
    speeds: [...S.walk(30)],
    proficiencies: [
        S.grantedSkillProficiency(4849, 1, 'DECEPTION', 'INSIGHT', 'PERCEPTION', 'STEALTH'),
        S.grantedLanguageProficiency(4849, 2, 'ABYSSAL', 'COMMON', 'INFERNAL', 'PRIMORDIAL')
    ],
    damageResistances: ['cold, fire; bludgeoning, piercing, and slashing from nonmagical attacks that aren\'t silvered'],
    conditionImmunities: ['charmed'],
    senses: ['darkvision 120 ft.'],
    passivePerception: 16,
    challengeRatingId: S.CR.CR_5,
    xp: 1800,
    features: [
        {
            id: S.featureId(204, 1),
            label: 'Innate Spellcasting',
            description: "Innate Spellcasting. The hag's innate spellcasting ability is Charisma (spell save DC 14). She can innately cast the following spells, requiring no material components: At will: detect magic, magic missile. 2/day each: plane shift (self only), ray of enfeeblement, sleep.",
            order: 1
        },
        {
            id: S.featureId(204, 2),
            label: 'Magic Resistance',
            description: 'Magic Resistance. The hag has advantage on saving throws against spells and other magical effects.',
            order: 2
        },
        {
            id: S.featureId(204, 3),
            label: 'Claws',
            description: 'Claws. Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 13 (2d8 + 4) slashing damage.',
            effects: [
                {
                    id: S.actionId(4849, 1),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(4849, 2),
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
                            id: S.actionId(4849, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(4849, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(4849, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('SLASHING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d8',
                                        bonuses: [
                                            {
                                                id: S.actionId(4849, 4),
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
            order: 3
        },
        {
            id: S.featureId(204, 4),
            label: 'Change Shape',
            description: "Change Shape. The hag magically polymorphs into a Small or Medium humanoid, or back into her true form. Her statistics are the same in each form. Any equipment she is wearing or carrying isn't transformed. She reverts to her true form if she dies.",
            effects: [
                {
                    id: S.actionId(4849, 5),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.ACTIVATED,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(4849, 6),
                            rangeKind: S.RANGE_KIND.SELF
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(4849, 7),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_USE,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(4849, 7) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(4849, 7),
                                        effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION
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
            id: S.featureId(204, 5),
            label: 'Etherealness',
            description: 'Etherealness. The hag magically enters the Ethereal Plane from the Material Plane, or vice versa. To do so, the hag must have a heartstone in her possession. The hag can affect and be affected only by other creatures on the Ethereal Plane, and creatures on the Material Plane cannot perceive her or interact with her, unless a special ability or magic allows them to.',
            effects: [
                {
                    id: S.actionId(4849, 8),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.ACTIVATED,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(4849, 9),
                            rangeKind: S.RANGE_KIND.SELF
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(4849, 10),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_USE,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(4849, 10) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(4849, 10),
                                        effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION
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
            id: S.featureId(204, 6),
            label: 'Nightmare Haunting (1/Day)',
            description: 'Nightmare Haunting (1/Day). While on the Ethereal Plane, the hag magically touches a sleeping humanoid on the Material Plane. A protection from evil and good spell cast on the target prevents this contact, as does magic circle. As long as the contact persists, the target has dreadful visions. If these visions last for at least 1 hour, the target gains no benefit from its rest, and its hit point maximum is reduced by 5 (1d10). If this effect reduces the target\'s hit point maximum to 0, the target dies, and if the target is awakened by any means other than the end of its rest, the target gains no benefit from that rest. The reduction to the target\'s hit point maximum lasts until removed by a greater restoration spell or similar magic.',
            effects: [
                {
                    id: S.actionId(4849, 11),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.ACTIVATED,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(4849, 12),
                            rangeKind: S.RANGE_KIND.SPECIAL
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(4849, 13),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_USE,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(4849, 13) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(4849, 13),
                                        effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION
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


