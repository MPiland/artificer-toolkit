import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const seaHag: CreatureAuthored = {
    id: S.CREATURE_IDS.SEA_HAG,
    label: 'Sea Hag',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.FEY,
    size: S.SIZE_CODE.MEDIUM,
    alignmentId: '00000000-0000-0000-0001-000900000000',
    abilityScores: {
        STRENGTH: 16,
        DEXTERITY: 13,
        CONSTITUTION: 16,
        INTELLIGENCE: 12,
        WISDOM: 12,
        CHARISMA: 13,
        SPELLCASTING: 0
    },
    armorClass: 14,
    hitPoints: 52,
    hitDice: '7d8+21',
    speeds: [...S.walk(30), ...S.swim(40)],
    passivePerception: 10,
    challengeRatingId: S.CR.CR_2,
    xp: 450,
    features: [
        {
            id: S.featureId(248, 1),
            label: 'Amphibious',
            description: 'Amphibious. The sea hag can breathe air and water.',
            order: 1
        },
        {
            id: S.featureId(248, 2),
            label: 'Horrific Appearance',
            description: 'Horrific Appearance. Any humanoid that starts its turn within 30 feet of the sea hag and can see the hag must succeed on a Wisdom saving throw or be frightened until the start of its next turn.',
            order: 2
        },
        {
            id: S.featureId(248, 3),
            label: 'Illusory Appearance',
            description: 'Illusory Appearance. The hag covers herself and anything she is wearing or carrying with a magical illusion that makes her look like an ugly creature of her general size and humanoid shape. The effect ends if the hag takes a bonus action to end it or if she dies.',
            order: 3
        },
        {
            id: S.featureId(248, 4),
            label: 'Claws',
            description: 'Claws. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) slashing damage.',
            effects: [
                {
                    id: S.actionId(3648, 1),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(3648, 2),
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
                            id: S.actionId(3648, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(3648, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(3648, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('SLASHING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d6+3'
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
            id: S.featureId(248, 5),
            label: 'Death Glare',
            description: 'Death Glare. The sea hag targets one creature it can see within 30 feet of it. The target must succeed on a Wisdom saving throw or be frightened until the end of its next turn; if the target has 25 hit points or fewer, it instead drops to 0 hit points.',
            order: 5
        }
    ]
};


