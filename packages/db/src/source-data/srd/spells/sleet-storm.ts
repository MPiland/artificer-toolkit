import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, DURATION_KIND, EFFECT_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SHAPE_KIND, SPELL_ATTRIBUTE, SUBJECT, TARGET_SELECTION_KIND, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const sleetStorm: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.SLEET_STORM,
    label: 'Sleet Storm',
    description: 'Until the spell ends, freezing rain and sleet fall in a 20-foot-tall cylinder with a 40-foot radius centered on a point you choose within range. The area is heavily obscured, and the ground in it becomes slick and difficult terrain.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 3,
    classIds: [CLASS_IDS.DRUID, CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
    magicSchoolId: schoolId('CONJURATION'),
    attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
    materialDescription: 'a pinch of dust and a few drops of water',
    effects: [
        {
            id: spellChildId(SPELL_IDS.SLEET_STORM, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.SLEET_STORM, 0x211, 1),
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 150,
                    unit: MEASUREMENT_UNIT_CODE.FEET
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS
                },
                shape: {
                    id: spellChildId(SPELL_IDS.SLEET_STORM, 0x212, 1),
                    shapeKind: SHAPE_KIND.CYLINDER,
                    radius: {
                        amount: 40,
                        unit: MEASUREMENT_UNIT_CODE.FEET
                    },
                    height: {
                        amount: 20,
                        unit: MEASUREMENT_UNIT_CODE.FEET
                    }
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.SLEET_STORM, 0x213, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.SLEET_STORM, 0x213, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        duration: {
                            id: spellChildId(SPELL_IDS.SLEET_STORM, 0x214, 1),
                            durationKind: DURATION_KIND.MINUTE,
                            amount: 1
                        },
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.SLEET_STORM, 0x213, 1),
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

