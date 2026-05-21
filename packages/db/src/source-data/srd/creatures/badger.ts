import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const badger: CreatureAuthored = {
    id: S.CREATURE_IDS.BADGER,
    label: 'Badger',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.BEAST,
    creatureTypeId: S.CREATURE_TYPE.BEAST,
    size: S.SIZE_CODE.TINY,
    alignmentId: '00000000-0000-0000-0001-000a00000000',
    abilityScores: {
        STRENGTH: 4,
        DEXTERITY: 11,
        CONSTITUTION: 12,
        INTELLIGENCE: 2,
        WISDOM: 12,
        CHARISMA: 5,
        SPELLCASTING: 0
    },
    armorClass: 10,
    hitPoints: 3,
    hitDice: '1d4+1',
    speeds: [...S.walk(20), ...S.burrow(5)],
    senses: ['darkvision 30 ft.'],
    passivePerception: 11,
    challengeRatingId: S.CR.CR_0,
    xp: 10,
    features: [
        {
            id: S.featureId(35, 1),
            label: 'Keen Smell',
            description: 'Keen Smell. The badger has advantage on Wisdom (Perception) checks that rely on smell.',
            order: 1
        },
        {
            id: S.featureId(35, 2),
            label: 'Bite',
            description: 'Bite. Melee Weapon Attack: +2 to hit, reach 5 ft., one target. Hit: 1 piercing damage.',
            effects: [
                {
                    id: S.actionId(35, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(35, 2),
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
                            id: S.actionId(35, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(35, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(35, 3),
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


