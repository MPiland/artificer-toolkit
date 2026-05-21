import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const treant: CreatureAuthored = {
    id: S.CREATURE_IDS.TREANT,
    label: 'Treant',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.PLANT,
    size: S.SIZE_CODE.HUGE,
    alignmentId: '00000000-0000-0000-0001-000300000000',
    abilityScores: {
        STRENGTH: 23,
        DEXTERITY: 8,
        CONSTITUTION: 21,
        INTELLIGENCE: 12,
        WISDOM: 16,
        CHARISMA: 12,
        SPELLCASTING: 0
    },
    armorClass: 16,
    armorClassNote: 'natural armor',
    hitPoints: 138,
    hitDice: '12d12+60',
    speeds: [...S.walk(30)],
    proficiencies: [
        S.grantedSkillProficiency(6752, 1, 'PERCEPTION')
    ],
    senses: ['passive Perception 16'],
    passivePerception: 16,
    challengeRatingId: S.CR.CR_9,
    xp: 5000,
    features: [
        {
            id: S.featureId(271, 1),
            label: 'False Appearance',
            description: 'False Appearance. While the treant remains motionless, it is indistinguishable from a normal tree.',
            order: 1
        },
        {
            id: S.featureId(271, 2),
            label: 'Siege Monster',
            description: 'Siege Monster. The treant deals double damage to objects and structures.',
            order: 2
        },
        {
            id: S.featureId(271, 3),
            label: 'Animate Trees',
            description: 'Animate Trees. The treant magically animates one or two trees it can see within 60 feet of it. The trees act as allies for a day or until the treant ends the effect.',
            order: 3
        },
        {
            id: S.featureId(271, 4),
            label: 'Multiattack',
            description: 'Multiattack. The treant makes two slam attacks.',
            order: 4
        },
        {
            id: S.featureId(271, 5),
            label: 'Slam',
            description: 'Slam. Melee Weapon Attack: +10 to hit, reach 5 ft., one target. Hit: 16 (3d6 + 6) bludgeoning damage.',
            effects: [
                {
                    id: S.actionId(6752, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(6752, 2),
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
                            id: S.actionId(6752, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(6752, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(6752, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '3d6+6'
                                    }
                                ]
                            }
                        }
                    ]
                }
            ],
            order: 5
        },
        {
            id: S.featureId(271, 6),
            label: 'Rock',
            description: 'Rock. Ranged Weapon Attack: +10 to hit, range 60/180 ft., one target. Hit: 28 (4d10 + 6) bludgeoning damage.',
            order: 6
        }
    ]
};


