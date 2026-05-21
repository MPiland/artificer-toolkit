import { ABILITY_CODE, ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, DURATION_KIND, EFFECT_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SUBJECT, TARGET_SELECTION_KIND, TARGET_DISPOSITION_KIND, TRIGGER, SPELL_COMPONENT, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { conditionTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const blindnessDeafness: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.BLINDNESS_DEAFNESS,
    label: 'Blindness/Deafness',
    description: 'You can blind or deafen a foe. Choose one creature that you can see within range to make a Constitution saving throw. On a failed save, the target is blinded or deafened (your choice) for the duration.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 2,
    classIds: [CLASS_IDS.BARD, CLASS_IDS.CLERIC, CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
    components: [SPELL_COMPONENT.VERBAL],
    magicSchoolId: schoolId('NECROMANCY'),
    effects: [
        {
            id: spellChildId(SPELL_IDS.BLINDNESS_DEAFNESS, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.SAVING_THROW,
                savingThrow: {
                    id: spellChildId(SPELL_IDS.BLINDNESS_DEAFNESS, 0x214, 2),
                    dcMethod: 'SOURCE_SAVE_DC',
                    ability: ABILITY_CODE.CONSTITUTION
                },
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.BLINDNESS_DEAFNESS, 0x211, 1),
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 30,
                    unit: MEASUREMENT_UNIT_CODE.FEET
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                    dispositionKind: TARGET_DISPOSITION_KIND.ANY
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.BLINDNESS_DEAFNESS, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_SAVE_FAIL,
                    groupType: PATH_GROUP_TYPE.CHOICE,
                    selectionKind: "CHOICE" as const,
                    options: [
                        {
                            id: spellChildId(SPELL_IDS.BLINDNESS_DEAFNESS, 0x212, 1),
                            order: 1,
                            resultBlock: {
                                id: spellChildId(SPELL_IDS.BLINDNESS_DEAFNESS, 0x212, 1) + "__result",
                                resultKind: "SINGLE" as const,
                                duration: {
                                    id: spellChildId(SPELL_IDS.BLINDNESS_DEAFNESS, 0x213, 1),
                                    durationKind: DURATION_KIND.MINUTE,
                                    amount: 1
                                },
                                outcomes: [
                                    {
                                        id: spellChildId(SPELL_IDS.BLINDNESS_DEAFNESS, 0x212, 1),
                                        effectKind: EFFECT_KIND.CONDITION,
                                        conditionId: conditionTypeId('BLINDED')
                                    }
                                ]
                            }
                        }
                    ]
                },
                {
                    id: spellChildId(SPELL_IDS.BLINDNESS_DEAFNESS, 0x214, 1),
                    order: 2,
                    pathCode: PATH_CODE.ON_SAVE_FAIL,
                    groupType: PATH_GROUP_TYPE.CHOICE,
                    selectionKind: "CHOICE" as const,
                    options: [
                        {
                            id: spellChildId(SPELL_IDS.BLINDNESS_DEAFNESS, 0x214, 1),
                            order: 1,
                            resultBlock: {
                                id: spellChildId(SPELL_IDS.BLINDNESS_DEAFNESS, 0x214, 1) + "__result",
                                resultKind: "SINGLE" as const,
                                duration: {
                                    id: spellChildId(SPELL_IDS.BLINDNESS_DEAFNESS, 0x215, 1),
                                    durationKind: DURATION_KIND.MINUTE,
                                    amount: 1
                                },
                                outcomes: [
                                    {
                                        id: spellChildId(SPELL_IDS.BLINDNESS_DEAFNESS, 0x214, 1),
                                        effectKind: EFFECT_KIND.CONDITION,
                                        conditionId: conditionTypeId('DEAFENED')
                                    }
                                ]
                            }
                        }
                    ]
                }
            ]
        }
    ],
    userId: SRD_USER_ID,
    systemId: SRD_SYSTEM_ID
};

