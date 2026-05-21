import { TARGET_DISPOSITION_KIND, DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared';
import { conditionTypeId } from '../equipment/shared.js';
import * as S from './shared.js';
export const dustMephit: CreatureAuthored = {
    id: S.CREATURE_IDS.DUST_MEPHIT,
    label: 'Dust Mephit',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.ELEMENTAL,
    size: S.SIZE_CODE.SMALL,
    alignmentId: '00000000-0000-0000-0001-000800000000',
    abilityScores: {
        STRENGTH: 5,
        DEXTERITY: 14,
        CONSTITUTION: 10,
        INTELLIGENCE: 9,
        WISDOM: 11,
        CHARISMA: 10,
        SPELLCASTING: 0
    },
    armorClass: 12,
    hitPoints: 17,
    hitDice: '5d6',
    speeds: [...S.walk(30), ...S.fly(30)],
    proficiencies: [
        S.grantedSkillProficiency(92, 1, 'PERCEPTION', 'STEALTH'),
        S.grantedLanguageProficiency(92, 2, 'AURAN', 'TERRAN')
    ],
    damageVulnerabilities: ['fire'],
    damageImmunities: ['poison'],
    conditionImmunities: ['poisoned'],
    senses: ['darkvision 60 ft.'],
    passivePerception: 12,
    challengeRatingId: S.CR.CR_1_2,
    xp: 100,
    features: [
        {
            id: S.featureId(92, 1),
            label: 'Death Burst',
            description: 'Death Burst. When the mephit dies, it explodes in a burst of dust. Each creature within 5 feet of it must then succeed on a DC 10 Constitution saving throw or be blinded for 1 minute. A blinded creature can repeat the saving throw on each of its turns, ending the effect on itself on a success.',
            order: 1
        },
        {
            id: S.featureId(92, 2),
            label: 'Innate Spellcasting (1/Day)',
            description: 'Innate Spellcasting (1/Day). The mephit can innately cast sleep, requiring no material components. Its innate spellcasting ability is Charisma.',
            order: 2
        },
        {
            id: S.featureId(92, 3),
            label: 'Claws',
            description: 'Claws. Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 4 (1d4 + 2) slashing damage.',
            effects: [
                {
                    id: S.actionId(92, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(92, 2),
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
                            id: S.actionId(92, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(92, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(92, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('SLASHING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d4+2'
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
            id: S.featureId(92, 4),
            label: 'Blinding Breath (Recharge 6)',
            description: 'Blinding Breath (Recharge 6). The mephit exhales a 15-foot cone of blinding dust. Each creature in that area must succeed on a DC 10 Dexterity saving throw or be blinded for 1 minute. A creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success.',
            effects: [
                {
                    id: S.actionId(92, 4),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.SAVING_THROW,
                        savingThrow: {
                            id: S.actionId(92, 7),
                            dcMethod: 'FIXED_DC',
                            ability: S.ABILITY_CODE.DEXTERITY,
                            baseDc: 10
                        },
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(92, 5),
                            rangeKind: S.RANGE_KIND.SPECIAL
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(92, 6),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_SAVE_FAIL,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(92, 6) + "__result",
                                resultKind: "SINGLE" as const,
                                duration: {
                                    id: S.actionId(92, 8),
                                    durationKind: DURATION_KIND.MINUTE,
                                    amount: 1
                                },
                                outcomes: [
                                    {
                                        id: S.actionId(92, 6),
                                        effectKind: S.EFFECT_KIND.CONDITION,
                                        conditionId: conditionTypeId('BLINDED')
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


