import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const giantShark: CreatureAuthored = {
    id: S.CREATURE_IDS.GIANT_SHARK,
    label: 'Giant Shark',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    category: S.CREATURE_CATEGORY_CODE.BEAST,
    creatureTypeId: S.CREATURE_TYPE.BEAST,
    size: S.SIZE_CODE.HUGE,
    alignmentId: '00000000-0000-0000-0001-000a00000000',
    abilityScores: {
        STRENGTH: 23,
        DEXTERITY: 11,
        CONSTITUTION: 21,
        INTELLIGENCE: 1,
        WISDOM: 10,
        CHARISMA: 5,
    },
    armorClass: 13,
    armorClassNote: 'natural armor',
    hitPoints: 126,
    hitDice: {
      count: 11,
      die: 12,
      modifier: 55,
    },
    speeds: [...S.walk(0), ...S.swim(50)],
    proficiencies: [
        S.grantedSkillProficiency(134, 1, 'PERCEPTION')
    ],
    senses: ['blindsight 60 ft.'],
    passivePerception: 13,
    challengeRatingId: S.CR.CR_5,
    xp: 1800,
    features: [
        {
            id: S.featureId(134, 1),
            label: 'Blood Frenzy',
            description: "Blood Frenzy. The shark has advantage on melee attack rolls against any creature that doesn't have all its hit points.",
            order: 1
        },
        {
            id: S.featureId(134, 2),
            label: 'Water Breathing',
            description: 'Water Breathing. The shark can breathe only underwater.',
            order: 2
        },
        {
            id: S.featureId(134, 3),
            label: 'Bite',
            description: 'Bite. Melee Weapon Attack: +9 to hit, reach 5 ft., one target. Hit: 22 (3d10 + 6) piercing damage. A giant shark is 30 feet long and normally found in deep oceans. Utterly fearless, it preys on anything that crosses its path, including whales and ships.',
            effects: [
                {
                    id: S.actionId(134, 1),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(134, 2),
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
                            id: S.actionId(134, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(134, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(134, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '3d10+6'
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


