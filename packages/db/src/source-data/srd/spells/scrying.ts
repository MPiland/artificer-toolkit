import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, EFFECT_KIND, MANIFEST_KIND, RANGE_KIND, SUBJECT, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const scrying: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.SCRYING,
    label: 'Scrying',
    description: 'You can see and hear a particular creature you choose that is on the same plane of existence as you. The target makes a Wisdom saving throw, modified by how well you know it and any connection you have to it.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.MINUTE, amount: 10 },
    level: 5,
    classIds: [CLASS_IDS.BARD, CLASS_IDS.CLERIC, CLASS_IDS.DRUID, CLASS_IDS.WARLOCK, CLASS_IDS.WIZARD],
    magicSchoolId: schoolId('DIVINATION'),
    effects: [
        {
            id: spellChildId(SPELL_IDS.SCRYING, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.SCRYING, 0x211, 1),
                    rangeKind: RANGE_KIND.SPECIAL
                },
                targeting: {
                    selectionKind: 'SINGLE_TARGET'
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.SCRYING, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.SCRYING, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        duration: {
                            id: spellChildId(SPELL_IDS.SCRYING, 0x213, 1),
                            durationKind: 'MINUTE',
                            amount: 10
                        },
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.SCRYING, 0x212, 1),
                                effectKind: EFFECT_KIND.MANIFEST,
                                manifestKind: MANIFEST_KIND.SENSOR
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

