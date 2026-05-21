import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, DURATION_KIND, EFFECT_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SUBJECT, TARGET_SELECTION_KIND, TARGET_DISPOSITION_KIND, TRIGGER, SPELL_COMPONENT, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const programmedIllusion: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.PROGRAMMED_ILLUSION,
    label: 'Programmed Illusion',
    description: 'You create an illusion of an object, a creature, or some other visible phenomenon within range that activates when a specific condition occurs. The illusion is imperceptible until then.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 6,
    classIds: [CLASS_IDS.BARD, CLASS_IDS.WIZARD],
    components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
    materialDescription: "a bit of fleece and jade dust worth at least 25 gp",
    magicSchoolId: schoolId('ILLUSION'),
    effects: [
        {
            id: spellChildId(SPELL_IDS.PROGRAMMED_ILLUSION, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.PROGRAMMED_ILLUSION, 0x201, 1),
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 120,
                    unit: MEASUREMENT_UNIT_CODE.FEET
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
                    dispositionKind: TARGET_DISPOSITION_KIND.ANY
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.PROGRAMMED_ILLUSION, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.PROGRAMMED_ILLUSION, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        duration: {
                            id: spellChildId(SPELL_IDS.PROGRAMMED_ILLUSION, 0x202, 1),
                            durationKind: DURATION_KIND.UNTIL_DISPELLED
                        },
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.PROGRAMMED_ILLUSION, 0x212, 1),
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

