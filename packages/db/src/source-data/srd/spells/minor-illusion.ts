import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, DURATION_KIND, EFFECT_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SUBJECT, TARGET_SELECTION_KIND, TARGET_DISPOSITION_KIND, TRIGGER, SPELL_COMPONENT, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { SRD_MAGIC_SCHOOLS, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js';
import { spellChildId } from './shared.js';
function schoolId(code: string): string {
    const entry = SRD_MAGIC_SCHOOLS.find((s) => s.code === code);
    if (!entry)
        throw new Error(`SRD magic school vocabulary entry for ${code} required for spell source data.`);
    return entry.id;
}
export const minorIllusion: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.MINOR_ILLUSION,
    label: 'Minor Illusion',
    description: 'You create a sound or an image of an object within range that lasts for 1 minute. A creature that sees through the illusion recognizes it as illusory.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 0,
    classIds: [CLASS_IDS.BARD, CLASS_IDS.SORCERER, CLASS_IDS.WARLOCK, CLASS_IDS.WIZARD],
    components: [SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
    materialDescription: "a bit of fleece",
    magicSchoolId: schoolId('ILLUSION'),
    effects: [
        {
            id: spellChildId(SPELL_IDS.MINOR_ILLUSION, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.MINOR_ILLUSION, 0x211, 1),
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 30,
                    unit: MEASUREMENT_UNIT_CODE.FEET
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
                    dispositionKind: TARGET_DISPOSITION_KIND.ANY
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.MINOR_ILLUSION, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.MINOR_ILLUSION, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        duration: {
                            id: spellChildId(SPELL_IDS.MINOR_ILLUSION, 0x213, 1),
                            durationKind: DURATION_KIND.MINUTE,
                            amount: 1
                        },
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.MINOR_ILLUSION, 0x212, 1),
                                effectKind: EFFECT_KIND.RULE
                            }
                        ]
                    }
                }
            ]
        }
    ],
    userId: SRD_USER_ID,
    systemId: SRD_SYSTEM_ID,
};

