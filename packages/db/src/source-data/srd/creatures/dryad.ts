import { DURATION_KIND, type CreatureAuthored } from '@artificer-toolkit/shared';
import { conditionTypeId } from '../equipment/shared.js';
import * as S from './shared.js';
export const dryad: CreatureAuthored = {
    id: S.CREATURE_IDS.DRYAD,
    label: 'Dryad',
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    category: S.CREATURE_CATEGORY_CODE.MONSTER,
    creatureTypeId: S.CREATURE_TYPE.FEY,
    size: S.SIZE_CODE.MEDIUM,
    abilityScores: {
        STRENGTH: 10,
        DEXTERITY: 12,
        CONSTITUTION: 11,
        INTELLIGENCE: 14,
        WISDOM: 15,
        CHARISMA: 18,
    },
    armorClass: 11,
    armorClassNote: '16 with barkskin',
    hitPoints: 22,
    hitDice: {
      count: 5,
      die: 8,
      modifier: 0,
    },
    speeds: [...S.walk(30)],
    proficiencies: [
        S.grantedSkillProficiency(90, 1, 'PERCEPTION', 'STEALTH'),
        S.grantedLanguageProficiency(90, 2, 'ELVISH', 'SYLVAN')
    ],
    senses: ['darkvision 60 ft.'],
    passivePerception: 14,
    challengeRatingId: S.CR.CR_1,
    xp: 200,
    features: [
        {
            id: S.featureId(90, 1),
            label: 'Innate Spellcasting',
            description: "Innate Spellcasting. The dryad's innate spellcasting ability is Charisma (spell save DC 14). The dryad can innately cast the following spells, requiring no material components: At will: druidcraft. 3/day each: entangle, goodberry. 1/day each: barkskin, pass without trace, shillelagh.",
            order: 1
        },
        {
            id: S.featureId(90, 2),
            label: 'Magic Resistance',
            description: 'Magic Resistance. The dryad has advantage on saving throws against spells and other magical effects.',
            order: 2
        },
        {
            id: S.featureId(90, 3),
            label: 'Speak with Beasts and Plants',
            description: 'Speak with Beasts and Plants. The dryad can communicate with beasts and plants as if they shared a language.',
            order: 3
        },
        {
            id: S.featureId(90, 4),
            label: 'Tree Stride',
            description: 'Tree Stride. Once on her turn, the dryad can use 10 feet of her movement to step magically into one living tree within her reach and emerge from a second living tree within 60 feet of the first tree, appearing in an unoccupied space within 5 feet of the second tree. Both trees must be Large or bigger.',
            order: 4
        },
        {
            id: S.featureId(90, 5),
            label: 'Club',
            description: 'Melee Weapon Attack: +2 to hit (+6 to hit with shillelagh), reach 5 ft., one target. Hit: 2 (1d4) bludgeoning damage, or 8 (1d8 + 4) bludgeoning damage with shillelagh.',
            effects: [
                {
                    id: S.actionId(90, 1),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(90, 2),
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
                            id: S.actionId(90, 3),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_HIT,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(90, 3) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: S.actionId(90, 3),
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
            order: 5
        },
        {
            id: S.featureId(90, 6),
            label: 'Fey Charm',
            description: "Fey Charm. The dryad targets one humanoid or beast that she can see within 30 feet of her. If the target can see the dryad, it must succeed on a DC 14 Wisdom saving throw or be magically charmed. The charmed creature regards the dryad as a trusted friend to be heeded and protected. Although the target isn't under the dryad's control, it takes the dryad's requests or actions in the most favorable way it can. Each time the dryad or its allies do anything harmful to the target, it can repeat the saving throw, ending the effect on itself on a success. Otherwise, the effect lasts 24 hours or until the dryad dies, is on a different plane of existence from the target, or ends the effect as a bonus action.",
            effects: [
                {
                    id: S.actionId(90, 4),
                    order: 1,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: S.TRIGGER.SAVING_THROW,
                        savingThrow: {
                            id: S.actionId(90, 7),
                            dcMethod: 'FIXED_DC',
                            ability: S.ABILITY_CODE.WISDOM,
                            baseDc: 14
                        },
                        activation: {
                            code: S.ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: S.actionId(90, 5),
                            rangeKind: S.RANGE_KIND.DISTANCE,
                            amount: 30,
                            unit: S.MEASUREMENT_UNIT_CODE.FEET
                        },
                        targeting: {
                            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
                            dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
                        }
                    },
                    paths: [
                        {
                            id: S.actionId(90, 6),
                            order: 1,
                            pathCode: S.PATH_CODE.ON_SAVE_FAIL,
                            groupType: S.PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: S.actionId(90, 6) + "__result",
                                resultKind: "SINGLE" as const,
                                duration: {
                                    id: S.actionId(90, 8),
                                    durationKind: DURATION_KIND.HOUR,
                                    amount: 24
                                },
                                outcomes: [
                                    {
                                        id: S.actionId(90, 6),
                                        effectKind: S.EFFECT_KIND.CONDITION,
                                        conditionId: conditionTypeId('CHARMED')
                                    }
                                ]
                            }
                        }
                    ]
                }
            ],
            order: 6
        }
    ]
};


