import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, EFFECT_KIND, MANIFEST_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SHAPE_KIND, SPELL_ATTRIBUTE, SUBJECT, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const entangle: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.ENTANGLE,
    label: 'Entangle',
    description: 'Grasping weeds and vines sprout from the ground in a 20-foot square starting from a point within range. The area becomes difficult terrain, and creatures in it risk being restrained by the plants.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 1,
    classIds: [CLASS_IDS.DRUID],
    magicSchoolId: schoolId('CONJURATION'),
    attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
    effects: [
        {
            id: spellChildId(SPELL_IDS.ENTANGLE, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.ENTANGLE, 0x211, 1),
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 90,
                    unit: MEASUREMENT_UNIT_CODE.FEET
                },
                shape: {
                    id: spellChildId(SPELL_IDS.ENTANGLE, 0x212, 1),
                    shapeKind: SHAPE_KIND.CUBE,
                    edgeLength: {
                        amount: 20,
                        unit: MEASUREMENT_UNIT_CODE.FEET
                    }
                },
                targeting: {
                    selectionKind: 'AREA_CONTENTS'
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.ENTANGLE, 0x213, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.ENTANGLE, 0x213, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        duration: {
                            id: spellChildId(SPELL_IDS.ENTANGLE, 0x214, 1),
                            durationKind: 'MINUTE',
                            amount: 1
                        },
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.ENTANGLE, 0x213, 1),
                                effectKind: EFFECT_KIND.MANIFEST,
                                manifestKind: MANIFEST_KIND.ZONE
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

