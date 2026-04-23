import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const deer: CreatureAuthored = {
    id: S.CREATURE_IDS.DEER,
    label: 'Deer',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.BEAST,
    creatureTypeId: S.CREATURE_TYPE.BEAST,
    size: S.SIZE_CODE.MEDIUM,
    alignmentId: '00000000-0000-0000-0001-000a00000000',
    abilityScores: {
        STRENGTH: 11,
        DEXTERITY: 16,
        CONSTITUTION: 11,
        INTELLIGENCE: 2,
        WISDOM: 14,
        CHARISMA: 5,
        SPELLCASTING: 0
    },
    armorClass: 13,
    hitPoints: 4,
    hitDice: '1d8',
    speeds: [...S.walk(50)],
    passivePerception: 12,
    challengeRatingId: S.CR.CR_0,
    xp: 10,
    features: [
        {
            id: S.featureId(79, 1),
            label: 'Bite',
            description: 'Bite. Melee Weapon Attack: +2 to hit, reach 5 ft., one target. Hit: 2 (1d4) piercing damage.',
            effects: [
                {
                    id: S.actionId(79, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(79, 2),
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
                            id: S.actionId(79, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(79, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(79, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
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
            order: 1
        }
    ]
};


