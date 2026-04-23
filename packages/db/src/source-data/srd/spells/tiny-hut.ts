import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, DURATION_KIND, EFFECT_KIND, MANIFEST_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SHAPE_KIND, SPELL_ATTRIBUTE, SUBJECT, TARGET_SELECTION_KIND, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const tinyHut: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.TINY_HUT,
    label: 'Tiny Hut',
    description: 'A 10-foot-radius immobile dome of force springs into existence around and above you and remains stationary for the duration. The spell ends if you leave its area.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.MINUTE, amount: 1 },
    level: 3,
    classIds: [CLASS_IDS.BARD, CLASS_IDS.WIZARD],
    magicSchoolId: schoolId('EVOCATION'),
    attributes: [SPELL_ATTRIBUTE.RITUAL],
    materialDescription: 'a small crystal bead',
    effects: [
        {
            id: spellChildId(SPELL_IDS.TINY_HUT, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.TINY_HUT, 0x201, 1),
                    rangeKind: RANGE_KIND.SELF
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.SELF
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.TINY_HUT, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.TINY_HUT, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        duration: {
                            id: spellChildId(SPELL_IDS.TINY_HUT, 0x202, 1),
                            durationKind: DURATION_KIND.HOUR,
                            amount: 8
                        },
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.TINY_HUT, 0x212, 1),
                                effectKind: EFFECT_KIND.MANIFEST,
                                manifestKind: MANIFEST_KIND.ZONE,
                                shape: {
                                    id: spellChildId(SPELL_IDS.TINY_HUT, 0x213, 1),
                                    shapeKind: SHAPE_KIND.SPHERE,
                                    radius: {
                                        amount: 10,
                                        unit: MEASUREMENT_UNIT_CODE.FEET
                                    }
                                }
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

