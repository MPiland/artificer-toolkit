import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const giantLizard: CreatureAuthored = {
    id: S.CREATURE_IDS.GIANT_LIZARD,
    label: 'Giant Lizard',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.BEAST,
    creatureTypeId: S.CREATURE_TYPE.BEAST,
    size: S.SIZE_CODE.LARGE,
    alignmentId: '00000000-0000-0000-0001-000a00000000',
    abilityScores: {
        STRENGTH: 15,
        DEXTERITY: 12,
        CONSTITUTION: 13,
        INTELLIGENCE: 2,
        WISDOM: 10,
        CHARISMA: 5,
        SPELLCASTING: 0
    },
    armorClass: 12,
    armorClassNote: 'natural armor',
    hitPoints: 19,
    hitDice: '3d10+3',
    speeds: [...S.walk(30), ...S.climb(30)],
    senses: ['darkvision 30 ft.'],
    passivePerception: 10,
    challengeRatingId: S.CR.CR_1_4,
    xp: 50,
    features: [
        {
            id: S.featureId(127, 1),
            label: 'Bite',
            description: 'Bite. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 6 (1d8 + 2) piercing damage. A giant lizard can be ridden or used as a draft animal. Lizardfolk also keep them as pets, and subterranean giant lizards are used as mounts and pack animals by drow, duergar, and others.',
            effects: [
                {
                    id: S.actionId(127, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(127, 2),
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
                            id: S.actionId(127, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(127, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(127, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d8+2'
                                    }
                                ]
                            }
                        }
                    ]
                }
            ],
            order: 1
        }
    ]
};


