import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const awakenedTree: CreatureAuthored = {
    id: S.CREATURE_IDS.AWAKENED_TREE,
    label: 'Awakened Tree',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.PLANT,
    size: S.SIZE_CODE.HUGE,
    alignmentId: '00000000-0000-0000-0001-000a00000000',
    abilityScores: {
        STRENGTH: 19,
        DEXTERITY: 6,
        CONSTITUTION: 15,
        INTELLIGENCE: 10,
        WISDOM: 10,
        CHARISMA: 7,
    },
    armorClass: 13,
    armorClassNote: 'natural armor',
    hitPoints: 59,
    hitDice: {
      count: 7,
      die: 12,
      modifier: 14,
    },
    speeds: [...S.walk(20)],
    damageVulnerabilities: ['fire'],
    damageResistances: ['bludgeoning', 'piercing'],
    passivePerception: 10,
    challengeRatingId: S.CR.CR_2,
    xp: 450,
    features: [
        {
            id: S.featureId(31, 1),
            label: 'False Appearance',
            description: 'False Appearance. While the tree remains motionless, it is indistinguishable from a normal tree.',
            order: 1
        },
        {
            id: S.featureId(31, 2),
            label: 'Language Knowledge',
            description: 'One language known by its creator.',
            order: 2
        },
        {
            id: S.featureId(31, 3),
            label: 'Slam',
            description: 'Slam. Melee Weapon Attack: +6 to hit, reach 10 ft., one target. Hit: 14 (3d6 + 4) bludgeoning damage. An awakened tree is an ordinary tree given sentience and mobility by the awaken spell or similar magic.',
            effects: [
                {
                    id: S.actionId(31, 1),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(31, 2),
                            rangeKind: S.RANGE_KIND.DISTANCE,
                            amount: 10,
                            unit: S.MEASUREMENT_UNIT_CODE.FEET
                        },
                        targeting: {
                            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
                            dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(31, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(31, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(31, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '3d6+4'
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


