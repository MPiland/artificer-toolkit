import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const cat: CreatureAuthored = {
    id: S.CREATURE_IDS.CAT,
    label: 'Cat',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    category: S.CREATURE_CATEGORY_CODE.BEAST,
    creatureTypeId: S.CREATURE_TYPE.BEAST,
    size: S.SIZE_CODE.TINY,
    alignmentId: '00000000-0000-0000-0001-000a00000000',
    abilityScores: {
        STRENGTH: 3,
        DEXTERITY: 15,
        CONSTITUTION: 10,
        INTELLIGENCE: 3,
        WISDOM: 12,
        CHARISMA: 7,
    },
    armorClass: 12,
    hitPoints: 2,
    hitDice: {
      count: 1,
      die: 4,
      modifier: 0,
    },
    speeds: [...S.walk(40), ...S.climb(30)],
    proficiencies: [
        S.grantedSkillProficiency(59, 1, 'PERCEPTION', 'STEALTH')
    ],
    passivePerception: 13,
    challengeRatingId: S.CR.CR_0,
    xp: 10,
    features: [
        {
            id: S.featureId(59, 1),
            label: 'Keen Smell',
            description: 'Keen Smell. The cat has advantage on Wisdom (Perception) checks that rely on smell.',
            order: 1
        },
        {
            id: S.featureId(59, 2),
            label: 'Claws',
            description: 'Claws. Melee Weapon Attack: +0 to hit, reach 5 ft., one target. Hit: 1 slashing damage.',
            effects: [
                {
                    id: S.actionId(59, 1),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(59, 2),
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
                            id: S.actionId(59, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(59, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(59, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('SLASHING'),
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


