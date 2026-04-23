import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const hawk: CreatureAuthored = {
    id: S.CREATURE_IDS.HAWK,
    label: 'Hawk',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.BEAST,
    creatureTypeId: S.CREATURE_TYPE.BEAST,
    size: S.SIZE_CODE.TINY,
    alignmentId: '00000000-0000-0000-0001-000a00000000',
    abilityScores: {
        STRENGTH: 5,
        DEXTERITY: 16,
        CONSTITUTION: 8,
        INTELLIGENCE: 2,
        WISDOM: 14,
        CHARISMA: 6,
        SPELLCASTING: 0
    },
    armorClass: 13,
    hitPoints: 1,
    hitDice: '1d4 - 1',
    speeds: [...S.walk(10), ...S.fly(60)],
    proficiencies: [
        S.grantedSkillProficiency(160, 1, 'PERCEPTION')
    ],
    passivePerception: 14,
    challengeRatingId: S.CR.CR_0,
    xp: 10,
    features: [
        {
            id: S.featureId(160, 1),
            label: 'Keen Sight',
            description: 'Keen Sight. The hawk has advantage on Wisdom (Perception) checks that rely on sight.',
            order: 1
        },
        {
            id: S.featureId(160, 2),
            label: 'Talons',
            description: 'Talons. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 1 slashing damage.',
            effects: [
                {
                    id: S.actionId(160, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(160, 2),
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
                            id: S.actionId(160, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(160, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(160, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('SLASHING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.FIXED,
                                        scalingKind: S.SCALING.NONE,
                                        amount: 1
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


