import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const warhorse: CreatureAuthored = {
    id: S.CREATURE_IDS.WARHORSE,
    label: 'Warhorse',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.BEAST,
    size: S.SIZE_CODE.LARGE,
    alignmentId: '00000000-0000-0000-0001-000a00000000',
    abilityScores: {
        STRENGTH: 18,
        DEXTERITY: 12,
        CONSTITUTION: 13,
        INTELLIGENCE: 2,
        WISDOM: 12,
        CHARISMA: 7,
        SPELLCASTING: 0
    },
    armorClass: 11,
    hitPoints: 19,
    hitDice: '3d10+3',
    speeds: [...S.walk(60)],
    passivePerception: 11,
    challengeRatingId: S.CR.CR_1_2,
    xp: 100,
    features: [
        {
            id: S.featureId(1917, 1),
            label: 'Trampling Charge',
            description: 'Trampling Charge. If the warhorse moves at least 20 feet straight toward a target and then hits it with a hooves attack on the same turn, the target must succeed on a Strength saving throw or be knocked prone. If the target is prone, the warhorse can make one hooves attack against it as a bonus action.',
            order: 1
        },
        {
            id: S.featureId(1917, 2),
            label: 'Hooves',
            description: 'Hooves. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 13 (2d8 + 4) bludgeoning damage.',
            effects: [
                {
                    id: S.actionId(1917, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(1917, 2),
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
                            id: S.actionId(1917, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(1917, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(1917, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d8+4'
                                    }
                                ]
                            }
                        }
                    ]
                }
            ],
            order: 2
        }
    ]
};


