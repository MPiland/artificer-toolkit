import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const warhorseSkeleton: CreatureAuthored = {
    id: S.CREATURE_IDS.WARHORSE_SKELETON,
    label: 'Warhorse Skeleton',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.UNDEAD,
    size: S.SIZE_CODE.LARGE,
    alignmentId: '00000000-0000-0000-0001-000700000000',
    abilityScores: {
        STRENGTH: 18,
        DEXTERITY: 12,
        CONSTITUTION: 15,
        INTELLIGENCE: 2,
        WISDOM: 8,
        CHARISMA: 5,
        SPELLCASTING: 0
    },
    armorClass: 13,
    armorClassNote: 'barding scraps',
    hitPoints: 22,
    hitDice: '3d10+6',
    speeds: [...S.walk(60)],
    damageVulnerabilities: ['bludgeoning'],
    damageImmunities: ['poison'],
    conditionImmunities: ['exhaustion', 'poisoned'],
    senses: ['darkvision 60 ft.'],
    passivePerception: 9,
    challengeRatingId: S.CR.CR_1_2,
    xp: 100,
    features: [
        {
            id: S.featureId(284, 1),
            label: 'Hooves',
            description: 'Hooves. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 11 (2d6 + 4) bludgeoning damage.',
            effects: [
                {
                    id: S.actionId(284, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(284, 2),
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
                            id: S.actionId(284, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(284, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(284, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d6',
                                        bonuses: [
                                            {
                                                id: S.actionId(284, 4),
                                                bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                                                ability: S.ABILITY_CODE.STRENGTH,
                                                order: 1
                                            }
                                        ]
                                    }
                                ]
                            }
                        }
                    ]
                }
            ],
            order: 1
        }
    ]
};


