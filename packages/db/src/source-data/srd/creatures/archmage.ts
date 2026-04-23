import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const archmage: CreatureAuthored = {
    id: S.CREATURE_IDS.ARCHMAGE,
    label: 'Archmage',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.NPC,
    creatureTypeId: S.CREATURE_TYPE.HUMANOID,
    size: S.SIZE_CODE.MEDIUM,
    tags: ['any race'],
    abilityScores: {
        STRENGTH: 10,
        DEXTERITY: 14,
        CONSTITUTION: 12,
        INTELLIGENCE: 20,
        WISDOM: 15,
        CHARISMA: 16,
        SPELLCASTING: 0
    },
    armorClass: 12,
    armorClassNote: '15 with mage armor',
    hitPoints: 99,
    hitDice: '18d8+18',
    speeds: [...S.walk(30)],
    proficiencies: [
        S.grantedSaveProficiency(28, 1, 'INTELLIGENCE', 'WISDOM'),
        S.grantedSkillProficiency(28, 2, 'ARCANA', 'HISTORY')
    ],
    damageResistances: ['damage from spells; nonmagical bludgeoning, piercing, and slashing (from stoneskin)'],
    passivePerception: 12,
    challengeRatingId: S.CR.CR_12,
    xp: 8400,
    features: [
        {
            id: S.featureId(28, 1),
            label: 'Magic Resistance',
            description: 'Magic Resistance. The archmage has advantage on saving throws against spells and other magical effects.',
            order: 1
        },
        {
            id: S.featureId(28, 2),
            label: 'Spellcasting',
            description: 'Spellcasting. The archmage is an 18th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 17, +9 to hit with spell attacks). The archmage can cast disguise self and invisibility at will and has the following wizard spells prepared: Cantrips (at will): fire bolt, light, mage hand, prestidigitation, shocking grasp. 1st level (4 slots): detect magic, identify, mage armor, magic missile. 2nd level (3 slots): detect thoughts, mirror image, misty step. 3rd level (3 slots): counterspell, fly, lightning bolt. 4th level (3 slots): banishment, fire shield, stoneskin. 5th level (3 slots): cone of cold, scrying, wall of force. 6th level (1 slot): globe of invulnerability. 7th level (1 slot): teleport. 8th level (1 slot): mind blank. 9th level (1 slot): time stop. The archmage casts mage armor, stoneskin, and mind blank on itself before combat.',
            order: 2
        },
        {
            id: S.featureId(28, 3),
            label: 'Language Knowledge',
            description: 'Any six languages.',
            order: 3
        },
        {
            id: S.featureId(28, 4),
            label: 'Dagger',
            description: 'Melee or Ranged Weapon Attack: +6 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 4 (1d4 + 2) piercing damage.',
            effects: [
                {
                    id: S.actionId(28, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(28, 2),
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
                            id: S.actionId(28, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(28, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(28, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d4',
                                        bonuses: [
                                            {
                                                id: S.actionId(28, 4),
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
                    id: S.actionId(28, 5),
                    order: 2,
                    invocation: {
                        triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(28, 6),
                            rangeKind: S.RANGE_KIND.SPECIAL
                        },
                        targeting: {
                            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(28, 7),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(28, 7) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(28, 7),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('PIERCING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d4',
                                        bonuses: [
                                            {
                                                id: S.actionId(28, 8),
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
            order: 4
        }
    ]
};


