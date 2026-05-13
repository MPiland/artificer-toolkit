import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const waterElemental: CreatureAuthored = {
    id: S.CREATURE_IDS.WATER_ELEMENTAL,
    label: 'Water Elemental',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.ELEMENTAL,
    size: S.SIZE_CODE.LARGE,
    alignmentId: '00000000-0000-0000-0001-000500000000',
    abilityScores: {
        STRENGTH: 18,
        DEXTERITY: 14,
        CONSTITUTION: 18,
        INTELLIGENCE: 5,
        WISDOM: 10,
        CHARISMA: 8,
        SPELLCASTING: 0
    },
    armorClass: 14,
    armorClassNote: 'natural armor',
    hitPoints: 114,
    hitDice: '12d10+48',
    speeds: [...S.walk(30), ...S.swim(90)],
    damageImmunities: ['poison'],
    conditionImmunities: ['exhaustion', 'grappled', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'unconscious'],
    senses: ['darkvision 60 ft.'],
    passivePerception: 10,
    challengeRatingId: S.CR.CR_5,
    xp: 1800,
    features: [
        {
            id: S.featureId(285, 1),
            label: 'Water Form',
            description: 'Water Form. The elemental can enter a hostile creature’s space and stop there. It can move through a space as narrow as 1 inch wide without squeezing.',
            order: 1
        },
        {
            id: S.featureId(285, 2),
            label: 'Freeze',
            description: 'Freeze. If the elemental takes cold damage, it partially solidifies; if it takes a lot of cold damage in a turn, it is slowed until the end of its next turn.',
            order: 2
        },
        {
            id: S.featureId(285, 3),
            label: 'Whelm',
            description: 'Whelm. Each creature in the elemental’s space must make a Strength saving throw or be grappled. While grappling a creature, the elemental can’t use slam attacks on other creatures, and the grappled creature is restrained and unable to breathe unless it can breathe water.',
            order: 3
        },
        {
            id: S.featureId(285, 4),
            label: 'Slam',
            description: 'Slam. Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 13 (2d8 + 4) bludgeoning damage.',
            effects: [
                {
                    id: S.actionId(6023, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(6023, 2),
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
                            id: S.actionId(6023, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(6023, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(6023, 3),
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


