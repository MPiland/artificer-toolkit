import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const rugOfSmothering: CreatureAuthored = {
    id: S.CREATURE_IDS.RUG_OF_SMOTHERING,
    label: 'Rug Of Smothering',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.CONSTRUCT,
    size: S.SIZE_CODE.MEDIUM,
    alignmentId: '00000000-0000-0000-0001-000a00000000',
    abilityScores: {
        STRENGTH: 17,
        DEXTERITY: 14,
        CONSTITUTION: 10,
        INTELLIGENCE: 1,
        WISDOM: 3,
        CHARISMA: 1,
        SPELLCASTING: 0
    },
    armorClass: 12,
    hitPoints: 33,
    hitDice: '6d8+6',
    speeds: [...S.walk(10)],
    passivePerception: 10,
    challengeRatingId: S.CR.CR_2,
    xp: 450,
    features: [
        {
            id: S.featureId(240, 1),
            label: 'False Appearance',
            description: 'False Appearance. While the rug remains motionless, it is indistinguishable from a normal rug.',
            order: 1
        },
        {
            id: S.featureId(240, 2),
            label: 'Smother',
            description: 'Smother. The rug targets one Medium or smaller creature within 5 feet of it. On a hit, the target is grappled (escape DC 13), and while grappled by the rug it is restrained and blinded. If the rug moves, the grappled target moves with it. If the target is still grappled at the start of the rug’s turn, the target takes bludgeoning damage and begins suffocating.',
            effects: [
                {
                    id: S.actionId(7705, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(7705, 2),
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
                            id: S.actionId(7705, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(7705, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(7705, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d6+3'
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


