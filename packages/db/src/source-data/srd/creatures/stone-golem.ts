import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const stoneGolem: CreatureAuthored = {
    id: S.CREATURE_IDS.STONE_GOLEM,
    label: 'Stone Golem',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.CONSTRUCT,
    size: S.SIZE_CODE.LARGE,
    alignmentId: '00000000-0000-0000-0001-000a00000000',
    abilityScores: {
        STRENGTH: 22,
        DEXTERITY: 9,
        CONSTITUTION: 20,
        INTELLIGENCE: 3,
        WISDOM: 11,
        CHARISMA: 1,
    },
    armorClass: 17,
    hitPoints: 178,
    hitDice: '17d10+85',
    speeds: [...S.walk(30)],
    conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'paralyzed', 'petrified', 'poisoned'],
    damageImmunities: ['poison', 'psychic'],
    senses: ['darkvision 120 ft.'],
    passivePerception: 10,
    challengeRatingId: S.CR.CR_10,
    xp: 5900,
    features: [
        {
            id: S.featureId(265, 1),
            label: 'Immutable Form',
            description: 'Immutable Form. The golem is immune to any spell or effect that would alter its form.',
            order: 1
        },
        {
            id: S.featureId(265, 2),
            label: 'Magic Resistance',
            description: 'Magic Resistance. The golem has advantage on saving throws against spells and other magical effects.',
            order: 2
        },
        {
            id: S.featureId(265, 3),
            label: 'Magic Weapons',
            description: 'Magic Weapons. The golem’s weapon attacks are magical.',
            order: 3
        },
        {
            id: S.featureId(265, 4),
            label: 'Slow',
            description: 'Slow. A creature hit by the golem’s slam attack must succeed on a Wisdom saving throw or be slowed until the end of its next turn.',
            order: 4
        },
        {
            id: S.featureId(265, 5),
            label: 'Slam',
            description: 'Slam. Melee Weapon Attack: +10 to hit, reach 5 ft., one target. Hit: 19 (3d8 + 6) bludgeoning damage.',
            effects: [
                {
                    id: S.actionId(3276, 1),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(3276, 2),
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
                            id: S.actionId(3276, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(3276, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(3276, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '3d8+6'
                                    }
                                ]
                            }
                        }
                    ]
                }
            ],
            order: 5
        }
    ]
};


