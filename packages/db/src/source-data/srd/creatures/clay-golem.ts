import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const clayGolem: CreatureAuthored = {
    id: S.CREATURE_IDS.CLAY_GOLEM,
    label: 'Clay Golem',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.CONSTRUCT,
    size: S.SIZE_CODE.LARGE,
    alignmentId: '00000000-0000-0000-0001-000a00000000',
    abilityScores: {
        STRENGTH: 20,
        DEXTERITY: 9,
        CONSTITUTION: 18,
        INTELLIGENCE: 3,
        WISDOM: 8,
        CHARISMA: 1,
        SPELLCASTING: 0
    },
    armorClass: 14,
    armorClassNote: 'natural armor',
    hitPoints: 133,
    hitDice: '14d10+56',
    speeds: [...S.walk(20)],
    damageImmunities: [
        'acid',
        'poison',
        'psychic',
        "bludgeoning, piercing, and slashing from nonmagical attacks that aren't adamantine"
    ],
    conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'paralyzed', 'petrified', 'poisoned'],
    senses: ['darkvision 60 ft.'],
    passivePerception: 9,
    challengeRatingId: S.CR.CR_9,
    xp: 5000,
    features: [
        {
            id: S.featureId(64, 1),
            label: 'Berserk',
            description: "Berserk. Whenever the golem starts its turn with 60 hit points or fewer, roll a d6. On a 6, the golem goes berserk. On each of its turns while berserk, the golem attacks the nearest creature it can see. If no creature is near enough to move to and attack, the golem attacks an object, with preference for an object smaller than itself. Once the golem goes berserk, it continues to do so until it is destroyed or regains all its hit points. The golem's creator, if within 60 feet of the berserk golem, can try to calm it by speaking firmly and persuasively. The golem must be able to hear its creator, who must take an action to make a DC 15 Charisma (Persuasion) check. If the check succeeds, the golem ceases being berserk. If it takes damage while still at 60 hit points or fewer, the golem might go berserk again.",
            order: 1
        },
        {
            id: S.featureId(64, 2),
            label: 'Immutable Form',
            description: 'Immutable Form. The golem is immune to any spell or effect that would alter its form.',
            order: 2
        },
        {
            id: S.featureId(64, 3),
            label: 'Magic Resistance',
            description: 'Magic Resistance. The golem has advantage on saving throws against spells and other magical effects.',
            order: 3
        },
        {
            id: S.featureId(64, 4),
            label: 'Magic Weapons',
            description: "Magic Weapons. The golem's weapon attacks are magical.",
            order: 4
        },
        {
            id: S.featureId(64, 5),
            label: 'Language Limitation',
            description: "Understands the languages of its creator but can't speak.",
            order: 5
        },
        {
            id: S.featureId(64, 6),
            label: 'Multiattack',
            description: 'The golem makes two slam attacks.',
            order: 6
        },
        {
            id: S.featureId(64, 7),
            label: 'Slam',
            description: 'Melee Weapon Attack: +8 to hit, reach 5 ft., one target. Hit: 15 (2d10 + 4) bludgeoning damage.',
            effects: [
                {
                    id: S.actionId(3256, 1),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(3256, 2),
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
                            id: S.actionId(3256, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(3256, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(3256, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '2d10',
                                        bonuses: [
                                            {
                                                id: S.actionId(3256, 4),
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
            order: 7
        },
        {
            id: S.featureId(64, 8),
            label: 'Haste (Recharge 5-6)',
            description: 'Haste (Recharge 5-6). The golem magically gains the benefits of the haste spell for 1d4 rounds, without requiring concentration, as if the spell had been cast by a 10th-level spellcaster.',
            effects: [
                {
                    id: S.actionId(3256, 5),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.ACTIVATED,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(3256, 6),
                            rangeKind: S.RANGE_KIND.SPECIAL
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(3256, 7),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_USE,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(3256, 7) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(3256, 7),
                                        effectKind: S.EFFECT_KIND.RULE
                                    }
                                ]
                            }
                        }
                    ]
                }
            ],
            order: 8
        }
    ]
};


