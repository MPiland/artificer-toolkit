import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const owl: CreatureAuthored = {
    id: S.CREATURE_IDS.OWL,
    label: 'Owl',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.BEAST,
    creatureTypeId: S.CREATURE_TYPE.BEAST,
    size: S.SIZE_CODE.TINY,
    alignmentId: '00000000-0000-0000-0001-000a00000000',
    abilityScores: {
        STRENGTH: 3,
        DEXTERITY: 13,
        CONSTITUTION: 8,
        INTELLIGENCE: 2,
        WISDOM: 12,
        CHARISMA: 7,
        SPELLCASTING: 0
    },
    armorClass: 11,
    hitPoints: 1,
    hitDice: '1d4 - 1',
    speeds: [...S.walk(5), ...S.fly(60)],
    proficiencies: [
        S.grantedSkillProficiency(214, 1, 'PERCEPTION', 'STEALTH')
    ],
    senses: ['darkvision 120 ft.'],
    passivePerception: 13,
    challengeRatingId: S.CR.CR_0,
    xp: 10,
    features: [
        {
            id: S.featureId(214, 1),
            label: 'Flyby',
            description: "Flyby. The owl doesn't provoke opportunity attacks when it flies out of an enemy's reach.",
            order: 1
        },
        {
            id: S.featureId(214, 2),
            label: 'Keen Hearing and Sight',
            description: 'Keen Hearing and Sight. The owl has advantage on Wisdom (Perception) checks that rely on hearing or sight.',
            order: 2
        },
        {
            id: S.featureId(214, 3),
            label: 'Talons',
            description: 'Talons. Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 1 slashing damage.',
            effects: [
                {
                    id: S.actionId(214, 1),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(214, 2),
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
                            id: S.actionId(214, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(214, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(214, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('SLASHING'),
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
            order: 3
        }
    ]
};


