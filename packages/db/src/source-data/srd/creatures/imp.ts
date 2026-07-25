import type { CreatureAuthored } from '@artificer-toolkit/shared';
import { conditionTypeId } from '../equipment/shared.js';
import * as S from './shared.js';
export const imp: CreatureAuthored = {
    id: S.CREATURE_IDS.IMP,
    label: 'Imp',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.FIEND,
    size: S.SIZE_CODE.TINY,
    alignmentId: '00000000-0000-0000-0001-000700000000',
    tags: ['devil', 'shapechanger'],
    abilityScores: {
        STRENGTH: 6,
        DEXTERITY: 17,
        CONSTITUTION: 13,
        INTELLIGENCE: 11,
        WISDOM: 12,
        CHARISMA: 14,
    },
    armorClass: 13,
    hitPoints: 10,
    hitDice: {
      count: 3,
      die: 4,
      modifier: 3,
    },
    speeds: [...S.walk(20), ...S.fly(40)],
    proficiencies: [
        S.grantedSkillProficiency(173, 1, 'DECEPTION', 'INSIGHT', 'PERSUASION', 'STEALTH'),
        S.grantedLanguageProficiency(173, 2, 'INFERNAL', 'COMMON')
    ],
    damageImmunities: ['fire', 'poison'],
    conditionImmunities: ['poisoned'],
    senses: ['darkvision 120 ft.'],
    passivePerception: 11,
    challengeRatingId: S.CR.CR_1,
    xp: 200,
    features: [
        {
            id: S.featureId(173, 1),
            label: 'Shapechanger',
            description: "Shapechanger. The imp can use its action to polymorph into a beast form that resembles a rat (speed 20 ft.), a raven (20 ft., fly 60 ft.), or a spider (20 ft., climb 20 ft.), or back into its true form. Its statistics are the same in each form, except for the speed changes noted. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.",
            order: 1
        },
        {
            id: S.featureId(173, 2),
            label: "Devil's Sight",
            description: "Devil's Sight. Magical darkness doesn't impede the imp's darkvision.",
            order: 2
        },
        {
            id: S.featureId(173, 3),
            label: 'Magic Resistance',
            description: 'Magic Resistance. The imp has advantage on saving throws against spells and other magical effects.',
            order: 3
        },
        {
            id: S.featureId(173, 4),
            label: 'Sting (Bite in Beast Form)',
            description: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one creature. Hit: 5 (1d4 + 3) piercing damage, and the target must succeed on a DC 11 Constitution saving throw or take 10 (3d6) poison damage.',
            effects: [
                {
                    id: S.actionId(173, 1),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(173, 2),
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
                            id: S.actionId(173, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(173, 3) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(173, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d4',
                                        bonuses: [
                                            {
                                                id: S.actionId(173, 4),
                                                bonusKind: S.DAMAGE_BONUS_KIND.ABILITY_BONUS,
                                                ability: S.ABILITY_CODE.DEXTERITY,
                                                order: 1
                                            }
                                        ]
                                    }
                                ]
                            }
                        },
                        {
                            id: S.actionId(173, 5),
                            order: 2,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(173, 5) + "__result",
                                resultKind: "SEQUENCE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(173, 5),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('POISON'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '3d6'
                                    }
                                ]
                            }
                        }
                    ]
                }
            ],
            order: 4
        },
        {
            id: S.featureId(173, 5),
            label: 'Invisibility',
            description: 'The imp magically turns invisible until it attacks or until its concentration ends (as if concentrating on a spell). Any equipment the imp wears or carries is invisible with it.',
            effects: [
                {
                    id: S.actionId(173, 6),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.ACTIVATED,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(173, 7),
                            rangeKind: S.RANGE_KIND.SPECIAL
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(173, 8),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_USE,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(173, 8) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(173, 8),
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


