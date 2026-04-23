import { ABILITY_CODE, ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, DURATION_KIND, EFFECT_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SPELL_ATTRIBUTE, SUBJECT, TARGET_SELECTION_KIND, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const suggestion: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.SUGGESTION,
    label: 'Suggestion',
    description: 'You suggest a course of activity and magically influence a creature you can see within range that can hear and understand you. The creature must make a Wisdom saving throw or follow the suggestion.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 2,
    classIds: [CLASS_IDS.WARLOCK],
    magicSchoolId: schoolId('ENCHANTMENT'),
    attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
    effects: [
        {
            id: spellChildId(SPELL_IDS.SUGGESTION, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.SAVING_THROW,
                savingThrow: {
                    id: spellChildId(SPELL_IDS.SUGGESTION, 0x211, 1),
                    savingThrowKind: 'SOURCE_SAVE_DC',
                    ability: ABILITY_CODE.WISDOM
                },
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.SUGGESTION, 0x212, 1),
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 30,
                    unit: MEASUREMENT_UNIT_CODE.FEET
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.SUGGESTION, 0x213, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_SAVE_FAIL,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.SUGGESTION, 0x213, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        duration: {
                            id: spellChildId(SPELL_IDS.SUGGESTION, 0x214, 1),
                            durationKind: DURATION_KIND.HOUR,
                            amount: 8
                        },
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.SUGGESTION, 0x213, 1),
                                effectKind: EFFECT_KIND.RULE
                            }
                        ]
                    }
                },
                {
                    id: spellChildId(SPELL_IDS.SUGGESTION, 0x215, 1),
                    order: 2,
                    pathCode: PATH_CODE.ON_SAVE_SUCCESS,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.SUGGESTION, 0x215, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.SUGGESTION, 0x215, 1),
                                effectKind: EFFECT_KIND.RULE
                            }
                        ]
                    }
                }
            ]
        }
    ],
    userId: SRD_USER_ID,
    systemId: SRD_SYSTEM_ID
};

