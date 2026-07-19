import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const bat: CreatureAuthored = {
    id: S.CREATURE_IDS.BAT,
    label: 'Bat',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    category: S.CREATURE_CATEGORY_CODE.BEAST,
    creatureTypeId: S.CREATURE_TYPE.BEAST,
    size: S.SIZE_CODE.TINY,
    alignmentId: '00000000-0000-0000-0001-000a00000000',
    abilityScores: {
        STRENGTH: 2,
        DEXTERITY: 15,
        CONSTITUTION: 8,
        INTELLIGENCE: 2,
        WISDOM: 12,
        CHARISMA: 4,
    },
    armorClass: 12,
    hitPoints: 1,
    hitDice: '1d4 - 1',
    speeds: [...S.walk(5), ...S.fly(30)],
    senses: ['blindsight 60 ft.'],
    passivePerception: 11,
    challengeRatingId: S.CR.CR_0,
    xp: 10,
    features: [
        {
            id: S.featureId(41, 1),
            label: 'Echolocation',
            description: "Echolocation. The bat can't use its blindsight while deafened.",
            order: 1
        },
        {
            id: S.featureId(41, 2),
            label: 'Keen Hearing',
            description: 'Keen Hearing. The bat has advantage on Wisdom (Perception) checks that rely on hearing.',
            order: 2
        },
        {
            id: S.featureId(41, 3),
            label: 'Bite',
            description: 'Bite. Melee Weapon Attack: +0 to hit, reach 5 ft., one creature. Hit: 1 piercing damage.',
            effects: [
                {
                    id: S.actionId(41, 1),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(41, 2),
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
                            id: S.actionId(41, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(41, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(41, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
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
            order: 3
        }
    ]
};


