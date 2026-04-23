import type { CreatureAuthored } from '@artificer-toolkit/shared';
import { conditionTypeId } from '../equipment/shared.js';
import * as S from './shared.js';
export const quasit: CreatureAuthored = {
    id: S.CREATURE_IDS.QUASIT,
    label: 'Quasit',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.FIEND,
    size: S.SIZE_CODE.TINY,
    alignmentId: '00000000-0000-0000-0001-000900000000',
    tags: ['demon', 'shapechanger'],
    abilityScores: {
        STRENGTH: 5,
        DEXTERITY: 17,
        CONSTITUTION: 10,
        INTELLIGENCE: 7,
        WISDOM: 10,
        CHARISMA: 10,
        SPELLCASTING: 0
    },
    armorClass: 13,
    hitPoints: 7,
    hitDice: '3d4',
    speeds: [...S.walk(20), ...S.fly(40)],
    proficiencies: [
        S.grantedSkillProficiency(2663, 1, 'PERCEPTION', 'STEALTH'),
        S.grantedLanguageProficiency(2663, 2, 'ABYSSAL', 'COMMON')
    ],
    damageImmunities: ['poison'],
    conditionImmunities: ['poisoned'],
    senses: ['darkvision 120 ft.'],
    passivePerception: 10,
    challengeRatingId: S.CR.CR_1,
    xp: 200,
    features: [
        {
            id: S.featureId(2663, 1),
            label: 'Shapechanger',
            description: "Shapechanger. The quasit can use its action to polymorph into a beast form that resembles a bat (speed 10 ft., fly 40 ft.), a centipede (40 ft., climb 40 ft.), or a toad (40 ft., swim 40 ft.), or back into its true form. Its statistics are the same in each form, except for the speed changes noted. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.",
            order: 1
        },
        {
            id: S.featureId(2663, 2),
            label: "Magic Resistance",
            description: "Magic Resistance. The quasit has advantage on saving throws against spells and other magical effects.",
            order: 2
        },
        {
            id: S.featureId(2663, 3),
            label: 'Claws',
            description: 'Claws. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 5 (1d4 + 3) slashing damage, and the target must succeed on a DC 10 Constitution saving throw or be poisoned for 1 minute. While poisoned in this way, the target is also frightened of the quasit. The target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success.',
            effects: [
                {
                    id: S.actionId(2663, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(2663, 2),
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
                            id: S.actionId(2663, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(2663, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(2663, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('SLASHING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d4',
                                        bonuses: [
                                            {
                                                id: S.actionId(2663, 4),
                                                bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                                                ability: S.ABILITY_CODE.DEXTERITY,
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
            order: 3
        },
        {
            id: S.featureId(2663, 4),
            label: 'Scare',
            description: "Scare. One creature of the quasit's choice within 20 feet of it must succeed on a DC 10 Wisdom saving throw or be frightened for 1 minute. The target can repeat the saving throw at the end of each of its turns, with disadvantage if the quasit is within line of sight, ending the effect on itself on a success.",
            order: 4
        },
        {
            id: S.featureId(2663, 5),
            label: 'Invisibility',
            description: 'Invisibility. The quasit magically turns invisible until it attacks or until its concentration ends (as if concentrating on a spell). Any equipment the quasit wears or carries is invisible with it.',
            effects: [
                {
                    id: S.actionId(2663, 5),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.ACTIVATED,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(2663, 6),
                            rangeKind: S.RANGE_KIND.SPECIAL
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(2663, 7),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_USE,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(2663, 7) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(2663, 7),
                                        effectKind: S.EFFECT_KIND.CONDITION,
                                        conditionId: conditionTypeId('INVISIBLE')
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


