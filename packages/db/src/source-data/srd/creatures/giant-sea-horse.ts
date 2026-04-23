import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const giantSeaHorse: CreatureAuthored = {
    id: S.CREATURE_IDS.GIANT_SEA_HORSE,
    label: 'Giant Sea Horse',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.BEAST,
    creatureTypeId: S.CREATURE_TYPE.BEAST,
    size: S.SIZE_CODE.LARGE,
    alignmentId: '00000000-0000-0000-0001-000a00000000',
    abilityScores: {
        STRENGTH: 12,
        DEXTERITY: 15,
        CONSTITUTION: 11,
        INTELLIGENCE: 2,
        WISDOM: 12,
        CHARISMA: 5,
        SPELLCASTING: 0
    },
    armorClass: 13,
    armorClassNote: 'natural armor',
    hitPoints: 16,
    hitDice: '3d10',
    speeds: [...S.walk(0), ...S.swim(40)],
    passivePerception: 11,
    challengeRatingId: S.CR.CR_1_2,
    xp: 100,
    features: [
        {
            id: S.featureId(133, 1),
            label: 'Charge',
            description: 'Charge. If the sea horse moves at least 20 feet straight toward a target and then hits it with a ram attack on the same turn, the target takes an extra 7 (2d6) bludgeoning damage. It the target is a creature, it must succeed on a DC 11 Strength saving throw or be knocked prone.',
            order: 1
        },
        {
            id: S.featureId(133, 2),
            label: 'Water Breathing',
            description: 'Water Breathing. The sea horse can breathe only underwater.',
            order: 2
        },
        {
            id: S.featureId(133, 3),
            label: 'Ram',
            description: 'Ram. Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 4 (1d6 + 1) bludgeoning damage. Like their smaller kin, giant sea horses are shy, colorful fish with elongated bodies and curled tails. Aquatic elves train them as mounts.',
            effects: [
                {
                    id: S.actionId(133, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(133, 2),
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
                            id: S.actionId(133, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(133, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(133, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d6+1'
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


