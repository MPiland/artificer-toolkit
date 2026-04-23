import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const mage: CreatureAuthored = {
    id: S.CREATURE_IDS.MAGE,
    label: 'Mage',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.NPC,
    creatureTypeId: S.CREATURE_TYPE.HUMANOID,
    size: S.SIZE_CODE.MEDIUM,
    tags: ['any race'],
    abilityScores: {
        STRENGTH: 9,
        DEXTERITY: 14,
        CONSTITUTION: 11,
        INTELLIGENCE: 17,
        WISDOM: 12,
        CHARISMA: 11,
        SPELLCASTING: 0
    },
    armorClass: 12,
    armorClassNote: '15 with mage armor',
    hitPoints: 40,
    hitDice: '9d8',
    speeds: [...S.walk(30)],
    proficiencies: [
        S.grantedSaveProficiency(187, 1, 'INTELLIGENCE', 'WISDOM'),
        S.grantedSkillProficiency(187, 2, 'ARCANA', 'HISTORY')
    ],
    passivePerception: 11,
    challengeRatingId: S.CR.CR_6,
    xp: 2300,
    features: [
        {
            id: S.featureId(187, 1),
            label: 'Spellcasting',
            description: 'Spellcasting. The mage is a 9th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 14, +6 to hit with spell attacks). The mage has the following wizard spells prepared: Cantrips (at will): fire bolt, light, mage hand, prestidigitation. 1st level (4 slots): detect magic, mage armor, magic missile, shield. 2nd level (3 slots): misty step, suggestion. 3rd level (3 slots): counterspell, fireball, fly. 4th level (3 slots): greater invisibility, ice storm. 5th level (1 slot): cone of cold.',
            order: 1
        },
        {
            id: S.featureId(187, 2),
            label: 'Language Knowledge',
            description: 'Any four languages.',
            order: 2
        },
        {
            id: S.featureId(187, 3),
            label: 'Dagger',
            description: 'Dagger. Melee or Ranged Weapon Attack: +5 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 4 (1d4 + 2) piercing damage.',
            effects: [
                {
                    id: S.actionId(187, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(187, 2),
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
                            id: S.actionId(187, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(187, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(187, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d4',
                                        bonuses: [
                                            {
                                                id: S.actionId(187, 4),
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
                },
                {
                    id: S.actionId(187, 5),
                    order: 2,
                    invocation: {
                        triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(187, 6),
                            rangeKind: S.RANGE_KIND.SPECIAL
                        },
                        targeting: {
                            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(187, 7),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(187, 7) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(187, 7),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d4',
                                        bonuses: [
                                            {
                                                id: S.actionId(187, 8),
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
        }
    ]
};


