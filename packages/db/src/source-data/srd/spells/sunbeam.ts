import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, EFFECT_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SHAPE_KIND, SPELL_ATTRIBUTE, SUBJECT, TARGET_SELECTION_KIND, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const sunbeam: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.SUNBEAM,
    label: 'Sunbeam',
    attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
    description: 'A brilliant 60-foot line of light flashes from your hand, burning and blinding creatures it catches, and you can fire the beam again with your action on later turns.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 6,
    classIds: [CLASS_IDS.DRUID, CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
    magicSchoolId: schoolId('EVOCATION'),
    materialDescription: 'a magnifying glass',
    effects: [
        {
            id: spellChildId(SPELL_IDS.SUNBEAM, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.SUNBEAM, 0x211, 1),
                    rangeKind: RANGE_KIND.SELF
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS
                },
                shape: {
                    id: spellChildId(SPELL_IDS.SUNBEAM, 0x212, 1),
                    shapeKind: SHAPE_KIND.LINE,
                    length: {
                        amount: 60,
                        unit: MEASUREMENT_UNIT_CODE.FEET
                    }
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.SUNBEAM, 0x213, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.SUNBEAM, 0x213, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        duration: {
                            id: spellChildId(SPELL_IDS.SUNBEAM, 0x214, 1),
                            durationKind: 'MINUTE',
                            amount: 1
                        },
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.SUNBEAM, 0x213, 1),
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

