import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const rustMonster: CreatureAuthored = {
    id: S.CREATURE_IDS.RUST_MONSTER,
    label: 'Rust Monster',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.MONSTROSITY,
    size: S.SIZE_CODE.MEDIUM,
    alignmentId: '00000000-0000-0000-0001-000a00000000',
    abilityScores: {
        STRENGTH: 13,
        DEXTERITY: 12,
        CONSTITUTION: 13,
        INTELLIGENCE: 2,
        WISDOM: 13,
        CHARISMA: 6,
        SPELLCASTING: 0
    },
    armorClass: 14,
    armorClassNote: 'natural armor',
    hitPoints: 27,
    hitDice: '5d8+5',
    speeds: [...S.walk(40)],
    passivePerception: 10,
    challengeRatingId: S.CR.CR_1_2,
    xp: 100,
    features: [
        {
            id: S.featureId(241, 1),
            label: 'Iron Scent',
            description: 'Iron Scent. The rust monster can pinpoint, by scent, the location of ferrous metal within 30 feet of it.',
            order: 1
        },
        {
            id: S.featureId(241, 2),
            label: 'Antennae',
            description: 'Antennae. A hit from the rust monster’s antennae corrodes a nonmagical ferrous metal weapon or armor. A metal weapon takes a cumulative and permanent penalty to damage rolls, and a metal armor takes a cumulative and permanent penalty to AC, until the item is destroyed or repaired by magic.',
            order: 2
        },
        {
            id: S.featureId(241, 3),
            label: 'Bite',
            description: 'Bite. Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 5 (1d8 + 1) piercing damage.',
            effects: [
                {
                    id: S.actionId(3591, 1),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(3591, 2),
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
                            id: S.actionId(3591, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(3591, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(3591, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d8+1'
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


