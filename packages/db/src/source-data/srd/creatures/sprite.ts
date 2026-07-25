import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const sprite: CreatureAuthored = {
    id: S.CREATURE_IDS.SPRITE,
    label: 'Sprite',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.FEY,
    size: S.SIZE_CODE.TINY,
    alignmentId: '00000000-0000-0000-0001-000200000000',
    abilityScores: {
        STRENGTH: 3,
        DEXTERITY: 18,
        CONSTITUTION: 10,
        INTELLIGENCE: 14,
        WISDOM: 13,
        CHARISMA: 11,
    },
    armorClass: 15,
    hitPoints: 2,
    hitDice: {
      count: 1,
      die: 4,
      modifier: 0,
    },
    speeds: [...S.walk(10), ...S.fly(40)],
    proficiencies: [
        S.grantedSkillProficiency(9803, 1, 'PERCEPTION', 'STEALTH')
    ],
    senses: ['darkvision 60 ft.'],
    passivePerception: 13,
    challengeRatingId: S.CR.CR_1_4,
    xp: 50,
    features: [
        {
            id: S.featureId(260, 1),
            label: 'Heart Sight',
            description: 'Heart Sight. The sprite can touch a creature and determine whether it is good, evil, or neither.',
            order: 1
        },
        {
            id: S.featureId(260, 2),
            label: 'Invisible',
            description: 'Invisible. The sprite is invisible. It becomes visible if it attacks or if it chooses to end the invisibility.',
            order: 2
        },
        {
            id: S.featureId(260, 3),
            label: 'Shortbow',
            description: 'Shortbow. Ranged Weapon Attack: +6 to hit, range 40/160 ft., one target. Hit: 1 piercing damage, and the target must make a Constitution saving throw or be poisoned for 1 minute.',
            order: 3
        },
        {
            id: S.featureId(260, 4),
            label: 'Shortsword',
            description: 'Shortsword. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 1 piercing damage.',
            effects: [
                {
                    id: S.actionId(9803, 1),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(9803, 2),
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
                            id: S.actionId(9803, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(9803, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(9803, 3),
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
            order: 4
        }
    ]
};


