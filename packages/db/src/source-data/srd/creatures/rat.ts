import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const rat: CreatureAuthored = {
    id: S.CREATURE_IDS.RAT,
    label: 'Rat',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    category: S.CREATURE_CATEGORY_CODE.BEAST,
    creatureTypeId: S.CREATURE_TYPE.BEAST,
    size: S.SIZE_CODE.TINY,
    alignmentId: '00000000-0000-0000-0001-000a00000000',
    abilityScores: {
        STRENGTH: 2,
        DEXTERITY: 11,
        CONSTITUTION: 9,
        INTELLIGENCE: 2,
        WISDOM: 10,
        CHARISMA: 4,
    },
    armorClass: 10,
    hitPoints: 1,
    hitDice: {
      count: 1,
      die: 4,
      modifier: -1,
    },
    speeds: [...S.walk(20)],
    senses: ['darkvision 30 ft.'],
    passivePerception: 10,
    challengeRatingId: S.CR.CR_0,
    xp: 10,
    features: [
        {
            id: S.featureId(231, 1),
            label: 'Keen Smell',
            description: 'Keen Smell. The rat has advantage on Wisdom (Perception) checks that rely on smell.',
            order: 1
        },
        {
            id: S.featureId(231, 2),
            label: 'Bite',
            description: 'Bite. Melee Weapon Attack: +0 to hit, reach 5 ft., one target. Hit: 1 piercing damage.',
            effects: [
                {
                    id: S.actionId(231, 1),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(231, 2),
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
                            id: S.actionId(231, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(231, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(231, 3),
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
            order: 2
        }
    ]
};


