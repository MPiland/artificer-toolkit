import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const crab: CreatureAuthored = {
    id: S.CREATURE_IDS.CRAB,
    label: 'Crab',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.BEAST,
    creatureTypeId: S.CREATURE_TYPE.BEAST,
    size: S.SIZE_CODE.TINY,
    alignmentId: '00000000-0000-0000-0001-000a00000000',
    abilityScores: {
        STRENGTH: 2,
        DEXTERITY: 11,
        CONSTITUTION: 10,
        INTELLIGENCE: 1,
        WISDOM: 8,
        CHARISMA: 2,
        SPELLCASTING: 0
    },
    armorClass: 11,
    armorClassNote: 'natural armor',
    hitPoints: 2,
    hitDice: '1d4',
    speeds: [...S.walk(20), ...S.swim(20)],
    proficiencies: [
        S.grantedSkillProficiency(72, 1, 'STEALTH')
    ],
    senses: ['blindsight 30 ft.'],
    passivePerception: 9,
    challengeRatingId: S.CR.CR_0,
    xp: 10,
    features: [
        {
            id: S.featureId(72, 1),
            label: 'Amphibious',
            description: 'Amphibious. The crab can breathe air and water.',
            order: 1
        },
        {
            id: S.featureId(72, 2),
            label: 'Claw',
            description: 'Claw. Melee Weapon Attack: +0 to hit, reach 5 ft., one target. Hit: 1 bludgeoning damage.',
            effects: [
                {
                    id: S.actionId(72, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(72, 2),
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
                            id: S.actionId(72, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(72, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(72, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('BLUDGEONING'),
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


