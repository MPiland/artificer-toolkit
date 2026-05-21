import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const lemure: CreatureAuthored = {
    id: S.CREATURE_IDS.LEMURE,
    label: 'Lemure',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.FIEND,
    size: S.SIZE_CODE.MEDIUM,
    alignmentId: '00000000-0000-0000-0001-000700000000',
    tags: ['devil'],
    abilityScores: {
        STRENGTH: 10,
        DEXTERITY: 5,
        CONSTITUTION: 11,
        INTELLIGENCE: 1,
        WISDOM: 11,
        CHARISMA: 3,
        SPELLCASTING: 0
    },
    armorClass: 7,
    hitPoints: 13,
    hitDice: '3d8',
    speeds: [...S.walk(15)],
    damageResistances: ['cold'],
    damageImmunities: ['fire', 'poison'],
    conditionImmunities: ['charmed', 'frightened', 'poisoned'],
    senses: ['darkvision 120 ft.'],
    passivePerception: 10,
    challengeRatingId: S.CR.CR_0,
    xp: 10,
    features: [
        {
            id: S.featureId(182, 1),
            label: "Devil's Sight",
            description: "Devil's Sight. Magical darkness doesn't impede the lemure's darkvision.",
            order: 1
        },
        {
            id: S.featureId(182, 2),
            label: 'Hellish Rejuvenation',
            description: 'Hellish Rejuvenation. A lemure that dies in the Nine Hells comes back to life with all its hit points in 1d10 days unless it is killed by a good-aligned creature with a bless spell cast on that creature or its remains are sprinkled with holy water.',
            order: 2
        },
        {
            id: S.featureId(182, 3),
            label: 'Language Limitation',
            description: 'Understands Infernal but can\'t speak.',
            grants: {
                proficiencies: [
                    S.grantedLanguageProficiency(182, 1, 'INFERNAL')
                ]
            },
            order: 3
        },
        {
            id: S.featureId(182, 4),
            label: 'Fist',
            description: 'Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 2 (1d4) bludgeoning damage.',
            effects: [
                {
                    id: S.actionId(182, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(182, 2),
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
                            id: S.actionId(182, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(182, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(182, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('BLUDGEONING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d4'
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


