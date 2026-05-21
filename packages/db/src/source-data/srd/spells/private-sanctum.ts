import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, DURATION_KIND, EFFECT_KIND, MANIFEST_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SHAPE_KIND, SUBJECT, TARGET_SELECTION_KIND, TARGET_DISPOSITION_KIND, TRIGGER, SPELL_COMPONENT, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const privateSanctum: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.PRIVATE_SANCTUM,
    label: 'Private Sanctum',
    description: 'You make an area within range magically secure. The area is a cube that can be as small as 5 feet to as large as 100 feet on each side.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.MINUTE, amount: 10 },
    level: 4,
    classIds: [CLASS_IDS.WIZARD],
    components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
    materialDescription: "a thin sheet of lead, a piece of opaque glass, a wad of cotton or cloth, and powdered chrysolite",
    magicSchoolId: schoolId('ABJURATION'),
    effects: [
        {
            id: spellChildId(SPELL_IDS.PRIVATE_SANCTUM, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.PRIVATE_SANCTUM, 0x201, 1),
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 120,
                    unit: MEASUREMENT_UNIT_CODE.FEET
                },
                shape: {
                    id: spellChildId(SPELL_IDS.PRIVATE_SANCTUM, 0x212, 1),
                    shapeKind: SHAPE_KIND.CUBE,
                    edgeLength: {
                        amount: 100,
                        unit: MEASUREMENT_UNIT_CODE.FEET
                    }
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
                    dispositionKind: TARGET_DISPOSITION_KIND.ANY
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.PRIVATE_SANCTUM, 0x213, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.PRIVATE_SANCTUM, 0x213, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        duration: {
                            id: spellChildId(SPELL_IDS.PRIVATE_SANCTUM, 0x202, 1),
                            durationKind: DURATION_KIND.HOUR,
                            amount: 24
                        },
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.PRIVATE_SANCTUM, 0x213, 1),
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

