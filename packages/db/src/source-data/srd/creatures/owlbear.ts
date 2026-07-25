import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const owlbear: CreatureAuthored = {
    id: S.CREATURE_IDS.OWLBEAR,
    label: 'Owlbear',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
    size: S.SIZE_CODE.LARGE,
    alignmentId: '00000000-0000-0000-0001-000a00000000',
    abilityScores: {
        STRENGTH: 20,
        DEXTERITY: 12,
        CONSTITUTION: 17,
        INTELLIGENCE: 3,
        WISDOM: 12,
        CHARISMA: 7,
    },
    armorClass: 13,
    armorClassNote: 'natural armor',
    hitPoints: 59,
    hitDice: {
      count: 7,
      die: 10,
      modifier: 21,
    },
    speeds: [...S.walk(40)],
    proficiencies: [
        S.grantedSkillProficiency(215, 1, 'PERCEPTION')
    ],
    senses: ['darkvision 60 ft.'],
    passivePerception: 13,
    challengeRatingId: S.CR.CR_3,
    xp: 700,
    features: [
        {
            id: S.featureId(215, 1),
            label: 'Keen Sight and Smell',
            description: 'Keen Sight and Smell. The owlbear has advantage on Wisdom (Perception) checks that rely on sight or smell.',
            order: 1
        },
        {
            id: S.featureId(215, 2),
            label: 'Multiattack',
            description: 'Multiattack. The owlbear makes two attacks: one with its beak and one with its claws.',
            order: 2
        },
        {
            id: S.featureId(215, 3),
            label: 'Beak',
            description: 'Beak. Melee Weapon Attack: +7 to hit, reach 5 ft., one creature. Hit: 10 (1d10 + 5) piercing damage.',
            effects: [
                {
                    id: S.actionId(215, 4),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(215, 5),
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
                            id: S.actionId(215, 6),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(215, 6) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(215, 6),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d10+5'
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
            id: S.featureId(215, 4),
            label: 'Claws',
            description: 'Claws. Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 14 (2d8 + 5) slashing damage.',
            effects: [
                {
                    id: S.actionId(215, 7),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(215, 8),
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
                            id: S.actionId(215, 9),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(215, 9) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(215, 9),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('SLASHING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d8+5'
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


