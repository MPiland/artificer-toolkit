import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, EFFECT_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SUBJECT, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const findTraps: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.FIND_TRAPS,
    label: 'Find Traps',
    description: 'You sense the presence of any trap within range that is within line of sight. A trap, for the purpose of this spell, includes anything that would inflict a sudden or unexpected effect you consider harmful or undesirable.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 2,
    classIds: [CLASS_IDS.CLERIC, CLASS_IDS.DRUID, CLASS_IDS.RANGER],
    magicSchoolId: schoolId('DIVINATION'),
    effects: [
        {
            id: spellChildId(SPELL_IDS.FIND_TRAPS, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.FIND_TRAPS, 0x211, 1),
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 120,
                    unit: MEASUREMENT_UNIT_CODE.FEET
                },
                targeting: {
                    selectionKind: 'AREA_CONTENTS'
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.FIND_TRAPS, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.FIND_TRAPS, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.FIND_TRAPS, 0x212, 1),
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

