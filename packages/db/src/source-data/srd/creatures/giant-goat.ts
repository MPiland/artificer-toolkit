import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const giantGoat: CreatureAuthored = {
    id: S.CREATURE_IDS.GIANT_GOAT,
    label: 'Giant Goat',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.BEAST,
    creatureTypeId: S.CREATURE_TYPE.BEAST,
    size: S.SIZE_CODE.LARGE,
    alignmentId: '00000000-0000-0000-0001-000a00000000',
    abilityScores: {
        STRENGTH: 17,
        DEXTERITY: 11,
        CONSTITUTION: 12,
        INTELLIGENCE: 3,
        WISDOM: 12,
        CHARISMA: 6,
        SPELLCASTING: 0
    },
    armorClass: 11,
    armorClassNote: 'natural armor',
    hitPoints: 19,
    hitDice: '3d10+3',
    speeds: [...S.walk(40)],
    passivePerception: 11,
    challengeRatingId: S.CR.CR_1_2,
    xp: 100,
    features: [
        {
            id: S.featureId(125, 1),
            label: 'Charge',
            description: 'Charge. If the goat moves at least 20 feet straight toward a target and then hits it with a ram attack on the same turn, the target takes an extra 5 (2d4) bludgeoning damage. If the target is a creature, it must succeed on a DC 13 Strength saving throw or be knocked prone.',
            order: 1
        },
        {
            id: S.featureId(125, 2),
            label: 'Sure-Footed',
            description: 'Sure-Footed. The goat has advantage on Strength and Dexterity saving throws made against effects that would knock it prone.',
            order: 2
        },
        {
            id: S.featureId(125, 3),
            label: 'Ram',
            description: 'Ram. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 8 (2d4 + 3) bludgeoning damage.',
            effects: [
                {
                    id: S.actionId(125, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(125, 2),
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
                            id: S.actionId(125, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(125, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(125, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d4+3'
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


