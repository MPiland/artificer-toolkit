import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, EFFECT_KIND, RANGE_KIND, SUBJECT, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const trueSeeing: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.TRUE_SEEING,
    label: 'True Seeing',
    description: 'This spell gives the willing creature you touch the ability to see things as they actually are. For the duration, the creature has truesight, notices secret doors hidden by magic, and can see into the Ethereal Plane.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 6,
    classIds: [
        CLASS_IDS.BARD,
        CLASS_IDS.CLERIC,
        CLASS_IDS.SORCERER,
        CLASS_IDS.WARLOCK,
        CLASS_IDS.WIZARD
    ],
    magicSchoolId: schoolId('DIVINATION'),
    effects: [
        {
            id: spellChildId(SPELL_IDS.TRUE_SEEING, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.TRUE_SEEING, 0x211, 1),
                    rangeKind: RANGE_KIND.TOUCH
                },
                targeting: {
                    selectionKind: 'SINGLE_TARGET'
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.TRUE_SEEING, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.TRUE_SEEING, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        duration: {
                            id: spellChildId(SPELL_IDS.TRUE_SEEING, 0x213, 1),
                            durationKind: 'HOUR',
                            amount: 1
                        },
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.TRUE_SEEING, 0x212, 1),
                                effectKind: EFFECT_KIND.RULE
                            }
                        ]
                    }
                }
            ]
        }
    ],
    materialDescription: 'an ointment for the eyes that costs 25 gp and is consumed by the spell',
    userId: SRD_USER_ID,
    systemId: SRD_SYSTEM_ID
};

