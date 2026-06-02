import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, DURATION_KIND, EFFECT_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SHAPE_KIND, SPELL_ATTRIBUTE, SUBJECT, TARGET_SELECTION_KIND, TARGET_DISPOSITION_KIND, TRIGGER, SPELL_COMPONENT, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const spikeGrowth: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.SPIKE_GROWTH,
    label: 'Spike Growth',
    attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
    description: 'A hidden field of spikes and thorns twists up from the ground in a 20-foot radius, becoming difficult terrain that tears at creatures moving through it.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 2,
    classIds: [CLASS_IDS.DRUID, CLASS_IDS.RANGER],
    components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
    materialDescription: "seven sharp thorns or seven small twigs, each sharpened to a point",
    magicSchoolId: schoolId('TRANSMUTATION'),
    effects: [
        {
            id: spellChildId(SPELL_IDS.SPIKE_GROWTH, 0x210, 1),
            order: 1,
            invocation: {
                kind: 'ACTION' as const,
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.SPIKE_GROWTH, 0x211, 1),
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 150,
                    unit: MEASUREMENT_UNIT_CODE.FEET
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
                    dispositionKind: TARGET_DISPOSITION_KIND.ANY
                },
                shape: {
                    id: spellChildId(SPELL_IDS.SPIKE_GROWTH, 0x212, 1),
                    shapeKind: SHAPE_KIND.SPHERE,
                    radius: {
                        amount: 20,
                        unit: MEASUREMENT_UNIT_CODE.FEET
                    }
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.SPIKE_GROWTH, 0x213, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    originKind: 'SOURCE' as const,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.SPIKE_GROWTH, 0x213, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        duration: {
                            id: spellChildId(SPELL_IDS.SPIKE_GROWTH, 0x214, 1),
                            durationKind: DURATION_KIND.MINUTE,
                            amount: 10
                        },
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.SPIKE_GROWTH, 0x213, 1),
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

