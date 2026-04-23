import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, DURATION_KIND, EFFECT_KIND, MANIFEST_KIND, RANGE_KIND, SUBJECT, TARGET_SELECTION_KIND, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const simulacrum: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.SIMULACRUM,
    label: 'Simulacrum',
    description: 'You shape snow or ice into an illusory duplicate of a beast or humanoid, creating a partially real copy with half the original\'s hit point maximum that lasts until dispelled.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.HOUR, amount: 12 },
    level: 7,
    classIds: [CLASS_IDS.WIZARD],
    magicSchoolId: schoolId('ILLUSION'),
    materialDescription: 'snow or ice in quantities sufficient to make a life-size copy of the duplicated creature; some hair, fingernail clippings, or another piece of that creature; and powdered ruby worth 1,500 gp, consumed by the spell',
    effects: [
        {
            id: spellChildId(SPELL_IDS.SIMULACRUM, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.SIMULACRUM, 0x211, 1),
                    rangeKind: RANGE_KIND.TOUCH
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.SIMULACRUM, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.SIMULACRUM, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        duration: {
                            id: spellChildId(SPELL_IDS.SIMULACRUM, 0x213, 1),
                            durationKind: DURATION_KIND.UNTIL_DISPELLED
                        },
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.SIMULACRUM, 0x212, 1),
                                effectKind: EFFECT_KIND.MANIFEST,
                                manifestKind: MANIFEST_KIND.CREATURE
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

