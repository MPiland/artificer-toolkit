import type { CreatureAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const succubusIncubus: CreatureAuthored = {
    id: S.CREATURE_IDS.SUCCUBUS_INCUBUS,
    label: 'Succubus Incubus',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    recordKind: S.CREATURE_RECORD_KIND_CODE.STAT_BLOCK,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.FIEND,
    size: S.SIZE_CODE.MEDIUM,
    alignmentId: '00000000-0000-0000-0001-000800000000',
    abilityScores: {
        STRENGTH: 8,
        DEXTERITY: 17,
        CONSTITUTION: 13,
        INTELLIGENCE: 15,
        WISDOM: 12,
        CHARISMA: 20,
        SPELLCASTING: 0
    },
    armorClass: 15,
    armorClassNote: 'natural armor',
    hitPoints: 66,
    hitDice: '12d8+12',
    speeds: [...S.walk(30), ...S.fly(60)],
    proficiencies: [
        S.grantedSkillProficiency(7009, 1, 'DECEPTION', 'INSIGHT', 'PERCEPTION', 'PERSUASION', 'STEALTH')
    ],
    damageResistances: ['cold', 'fire', 'lightning', 'poison'],
    conditionImmunities: ['charmed'],
    senses: ['darkvision 60 ft.'],
    passivePerception: 15,
    challengeRatingId: S.CR.CR_4,
    xp: 1100,
    features: [
        {
            id: S.featureId(267, 1),
            label: 'Shapechanger',
            description: 'Shapechanger. The fiend can magically polymorph into a humanoid it has seen, or back into its true form.',
            order: 1
        },
        {
            id: S.featureId(267, 2),
            label: 'Telepathic Bond',
            description: 'Telepathic Bond. The fiend can communicate telepathically with a creature it can see within 60 feet of it.',
            order: 2
        },
        {
            id: S.featureId(267, 3),
            label: 'Draining Kiss',
            description: 'Draining Kiss. A charmed or willing creature kissed by the fiend takes psychic damage and its hit point maximum is reduced by the same amount until it finishes a long rest.',
            order: 3
        },
        {
            id: S.featureId(267, 4),
            label: 'Claws',
            description: 'Claws. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) slashing damage.',
            effects: [
                {
                    id: S.actionId(7009, 1),
                    order: 1,
                    invocation: {
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(7009, 2),
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
                            id: S.actionId(7009, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(7009, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(7009, 3),
                                        effectKind: S.EFFECT_KIND.DAMAGE,
                                        damageTypeId: S.damageTypeId('SLASHING'),
                                        valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                        scalingKind: S.SCALING.NONE,
                                        diceConfig: '1d6+3'
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


