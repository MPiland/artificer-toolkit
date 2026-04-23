import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const quipper: CreatureAuthored = {
    id: S.CREATURE_IDS.QUIPPER,
    label: 'Quipper',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.BEAST,
    creatureTypeId: S.CREATURE_TYPE.BEAST,
    size: S.SIZE_CODE.TINY,
    alignmentId: '00000000-0000-0000-0001-000a00000000',
    abilityScores: {
        STRENGTH: 2,
        DEXTERITY: 16,
        CONSTITUTION: 9,
        INTELLIGENCE: 1,
        WISDOM: 7,
        CHARISMA: 2,
        SPELLCASTING: 0
    },
    armorClass: 13,
    hitPoints: 1,
    hitDice: '1d4 - 1',
    speeds: [...S.walk(0), ...S.swim(40)],
    senses: ['darkvision 60 ft.'],
    passivePerception: 8,
    challengeRatingId: S.CR.CR_0,
    xp: 10,
    features: [
        {
            id: S.featureId(229, 1),
            label: 'Blood Frenzy',
            description: "Blood Frenzy. The quipper has advantage on melee attack rolls against any creature that doesn't have all its hit points.",
            order: 1
        },
        {
            id: S.featureId(229, 2),
            label: 'Water Breathing',
            description: 'Water Breathing. The quipper can breathe only underwater.',
            order: 2
        },
        {
            id: S.featureId(229, 3),
            label: 'Bite',
            description: 'Bite. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 1 piercing damage. A quipper is a carnivorous fish with sharp teeth.',
            effects: [
                {
                    id: S.actionId(229, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(229, 2),
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
                            id: S.actionId(229, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(229, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(229, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1'
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


