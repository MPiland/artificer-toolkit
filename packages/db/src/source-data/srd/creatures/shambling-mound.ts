import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const shamblingMound: CreatureAuthored = {
    id: S.CREATURE_IDS.SHAMBLING_MOUND,
    label: 'Shambling Mound',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.PLANT,
    size: S.SIZE_CODE.LARGE,
    alignmentId: '00000000-0000-0000-0001-000a00000000',
    abilityScores: {
        STRENGTH: 18,
        DEXTERITY: 8,
        CONSTITUTION: 16,
        INTELLIGENCE: 5,
        WISDOM: 10,
        CHARISMA: 5,
        SPELLCASTING: 0
    },
    armorClass: 15,
    hitPoints: 136,
    hitDice: '16d10+48',
    speeds: [...S.walk(20), ...S.swim(20)],
    conditionImmunities: ['blinded', 'deafened', 'exhaustion'],
    damageResistances: ['cold'],
    damageImmunities: ['lightning'],
    passivePerception: 10,
    challengeRatingId: S.CR.CR_5,
    xp: 1800,
    features: [
        {
            id: S.featureId(251, 1),
            label: 'False Appearance',
            description: 'False Appearance. While the mound remains motionless, it is indistinguishable from a hump of wet earth.',
            order: 1
        },
        {
            id: S.featureId(251, 2),
            label: 'Lightning Absorption',
            description: 'Lightning Absorption. Whenever the mound is subjected to lightning damage, it takes no damage and regains hit points instead.',
            order: 2
        },
        {
            id: S.featureId(251, 3),
            label: 'Engulf',
            description: 'Engulf. If the mound moves through a creature’s space, that creature must make a Dexterity saving throw or be engulfed. An engulfed creature is restrained, blinded, and unable to breathe, and it takes bludgeoning damage at the start of each of the mound’s turns until it escapes.',
            order: 3
        },
        {
            id: S.featureId(251, 4),
            label: 'Slam',
            description: 'Slam. Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 13 (2d8 + 4) bludgeoning damage.',
            effects: [
                {
                    id: S.actionId(4581, 1),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(4581, 2),
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
                            id: S.actionId(4581, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(4581, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(4581, 3),
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
            order: 4
        }
    ]
};


