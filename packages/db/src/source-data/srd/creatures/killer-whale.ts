import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const killerWhale: CreatureAuthored = {
    id: S.CREATURE_IDS.KILLER_WHALE,
    label: 'Killer Whale',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    category: S.CREATURE_CATEGORY_CODE.BEAST,
    creatureTypeId: S.CREATURE_TYPE.BEAST,
    size: S.SIZE_CODE.HUGE,
    alignmentId: '00000000-0000-0000-0001-000a00000000',
    abilityScores: {
        STRENGTH: 19,
        DEXTERITY: 10,
        CONSTITUTION: 13,
        INTELLIGENCE: 3,
        WISDOM: 12,
        CHARISMA: 7,
    },
    armorClass: 12,
    armorClassNote: 'natural armor',
    hitPoints: 90,
    hitDice: '12d12+12',
    speeds: [...S.walk(0), ...S.swim(60)],
    proficiencies: [
        S.grantedSkillProficiency(177, 1, 'PERCEPTION')
    ],
    senses: ['blindsight 120 ft.'],
    passivePerception: 13,
    challengeRatingId: S.CR.CR_3,
    xp: 700,
    features: [
        {
            id: S.featureId(177, 1),
            label: 'Echolocation',
            description: "Echolocation. The whale can't use its blindsight while deafened.",
            order: 1
        },
        {
            id: S.featureId(177, 2),
            label: 'Hold Breath',
            description: 'Hold Breath. The whale can hold its breath for 30 minutes.',
            order: 2
        },
        {
            id: S.featureId(177, 3),
            label: 'Keen Hearing',
            description: 'Keen Hearing. The whale has advantage on Wisdom (Perception) checks that rely on hearing.',
            order: 3
        },
        {
            id: S.featureId(177, 4),
            label: 'Bite',
            description: 'Bite. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 21 (5d6 + 4) piercing damage.',
            effects: [
                {
                    id: S.actionId(177, 1),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(177, 2),
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
                            id: S.actionId(177, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(177, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(177, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '5d6+4'
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


