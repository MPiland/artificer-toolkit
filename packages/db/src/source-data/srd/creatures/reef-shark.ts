import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const reefShark: CreatureAuthored = {
    id: S.CREATURE_IDS.REEF_SHARK,
    label: 'Reef Shark',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.BEAST,
    creatureTypeId: S.CREATURE_TYPE.BEAST,
    size: S.SIZE_CODE.MEDIUM,
    alignmentId: '00000000-0000-0000-0001-000a00000000',
    abilityScores: {
        STRENGTH: 14,
        DEXTERITY: 13,
        CONSTITUTION: 13,
        INTELLIGENCE: 1,
        WISDOM: 10,
        CHARISMA: 4,
        SPELLCASTING: 0
    },
    armorClass: 12,
    armorClassNote: 'natural armor',
    hitPoints: 22,
    hitDice: '4d8+4',
    speeds: [...S.walk(0), ...S.swim(40)],
    proficiencies: [
        S.grantedSkillProficiency(234, 1, 'PERCEPTION')
    ],
    senses: ['blindsight 30 ft.'],
    passivePerception: 12,
    challengeRatingId: S.CR.CR_1_2,
    xp: 100,
    features: [
        {
            id: S.featureId(234, 1),
            label: 'Pack Tactics',
            description: "Pack Tactics. The shark has advantage on an attack roll against a creature if at least one of the shark's allies is within 5 feet of the creature and the ally isn't incapacitated.",
            order: 1
        },
        {
            id: S.featureId(234, 2),
            label: 'Water Breathing',
            description: 'Water Breathing. The shark can breathe only underwater.',
            order: 2
        },
        {
            id: S.featureId(234, 3),
            label: 'Bite',
            description: 'Bite. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 6 (1d8 + 2) piercing damage.',
            effects: [
                {
                    id: S.actionId(234, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(234, 2),
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
                            id: S.actionId(234, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(234, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(234, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d8+2'
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


