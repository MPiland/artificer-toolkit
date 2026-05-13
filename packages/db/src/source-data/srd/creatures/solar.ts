import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const solar: CreatureAuthored = {
    id: S.CREATURE_IDS.SOLAR,
    label: 'Solar',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.CELESTIAL,
    size: S.SIZE_CODE.LARGE,
    alignmentId: '00000000-0000-0000-0001-000100000000',
    abilityScores: {
        STRENGTH: 26,
        DEXTERITY: 22,
        CONSTITUTION: 26,
        INTELLIGENCE: 25,
        WISDOM: 25,
        CHARISMA: 30,
        SPELLCASTING: 0
    },
    armorClass: 21,
    armorClassNote: 'natural armor',
    hitPoints: 243,
    hitDice: '18d10+144',
    speeds: [...S.walk(50), ...S.fly(150)],
    damageResistances: ['radiant'],
    damageImmunities: ['necrotic', 'poison'],
    conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'poisoned'],
    senses: ['truesight 120 ft.'],
    passivePerception: 24,
    challengeRatingId: S.CR.CR_21,
    xp: 33000,
    features: [
        {
            id: S.featureId(256, 1),
            label: 'Angelic Weapons',
            description: 'Angelic Weapons. The solar’s weapon attacks are magical and deal radiant damage in addition to their normal damage.',
            order: 1
        },
        {
            id: S.featureId(256, 2),
            label: 'Divine Awareness',
            description: 'Divine Awareness. The solar knows if it hears a lie and can perceive invisible creatures and objects within 30 feet of it.',
            order: 2
        },
        {
            id: S.featureId(256, 3),
            label: 'Healing Touch',
            description: 'Healing Touch. The solar touches another creature and magically restores a large amount of hit points.',
            order: 3
        },
        {
            id: S.featureId(256, 4),
            label: 'Greatsword',
            description: 'Greatsword. Melee Weapon Attack: +15 to hit, reach 5 ft., one target. Hit: 22 (4d6 + 8) slashing damage plus 27 (6d8) radiant damage.',
            effects: [
                {
                    id: S.actionId(8625, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(8625, 2),
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
                            id: S.actionId(8625, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(8625, 3) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(8625, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('SLASHING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '4d6+8'
                                    }
                                ]
                            }
                        }
                    ]
                }
            ],
            order: 4
        },
        {
            id: S.featureId(256, 5),
            label: 'Longbow',
            description: 'Longbow. Ranged Weapon Attack: +13 to hit, range 150/600 ft., one target. Hit: 15 (2d8 + 6) piercing damage plus radiant damage.',
            order: 5
        }
    ]
};


