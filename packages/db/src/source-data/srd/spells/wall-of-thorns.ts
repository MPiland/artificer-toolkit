import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, DURATION_KIND, EFFECT_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SHAPE_KIND, SPELL_ATTRIBUTE, SUBJECT, TARGET_SELECTION_KIND, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const wallOfThorns: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.WALL_OF_THORNS,
    label: 'Wall of Thorns',
    attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
    description: 'You raise a dense wall of thorny brush on a solid surface, injuring creatures that pass through it or start too close to it.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 6,
    classIds: [CLASS_IDS.DRUID],
    magicSchoolId: schoolId('CONJURATION'),
    materialDescription: 'a handful of thorns',
    effects: [
        {
            id: spellChildId(SPELL_IDS.WALL_OF_THORNS, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.WALL_OF_THORNS, 0x211, 1),
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 120,
                    unit: MEASUREMENT_UNIT_CODE.FEET
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS
                },
                shape: {
                    id: spellChildId(SPELL_IDS.WALL_OF_THORNS, 0x212, 1),
                    shapeKind: SHAPE_KIND.WALL,
                    length: {
                        amount: 60,
                        unit: MEASUREMENT_UNIT_CODE.FEET
                    },
                    height: {
                        amount: 10,
                        unit: MEASUREMENT_UNIT_CODE.FEET
                    },
                    thickness: {
                        amount: 5,
                        unit: MEASUREMENT_UNIT_CODE.FEET
                    }
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.WALL_OF_THORNS, 0x213, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.WALL_OF_THORNS, 0x213, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        duration: {
                            id: spellChildId(SPELL_IDS.WALL_OF_THORNS, 0x214, 1),
                            durationKind: DURATION_KIND.MINUTE,
                            amount: 10
                        },
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.WALL_OF_THORNS, 0x213, 1),
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

