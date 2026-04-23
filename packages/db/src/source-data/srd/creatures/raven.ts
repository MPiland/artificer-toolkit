import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const raven: CreatureAuthored = {
    id: S.CREATURE_IDS.RAVEN,
    label: 'Raven',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.BEAST,
    creatureTypeId: S.CREATURE_TYPE.BEAST,
    size: S.SIZE_CODE.TINY,
    alignmentId: '00000000-0000-0000-0001-000a00000000',
    abilityScores: {
        STRENGTH: 2,
        DEXTERITY: 14,
        CONSTITUTION: 8,
        INTELLIGENCE: 2,
        WISDOM: 12,
        CHARISMA: 6,
        SPELLCASTING: 0
    },
    armorClass: 12,
    hitPoints: 1,
    hitDice: '1d4 - 1',
    speeds: [...S.walk(10), ...S.fly(50)],
    proficiencies: [
        S.grantedSkillProficiency(232, 1, 'PERCEPTION')
    ],
    passivePerception: 13,
    challengeRatingId: S.CR.CR_0,
    xp: 10,
    features: [
        {
            id: S.featureId(232, 1),
            label: 'Mimicry',
            description: 'Mimicry. The raven can mimic simple sounds it has heard, such as a person whispering, a baby crying, or an animal chittering. A creature that hears the sounds can tell they are imitations with a successful DC 10 Wisdom (Insight) check.',
            order: 1
        },
        {
            id: S.featureId(232, 2),
            label: 'Beak',
            description: 'Beak. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 1 piercing damage.',
            effects: [
                {
                    id: S.actionId(232, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(232, 2),
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
                            id: S.actionId(232, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(232, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(232, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1'
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


