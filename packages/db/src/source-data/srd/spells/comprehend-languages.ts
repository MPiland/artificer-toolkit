import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, EFFECT_KIND, RANGE_KIND, SPELL_ATTRIBUTE, SUBJECT, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const comprehendLanguages: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.COMPREHEND_LANGUAGES,
    label: 'Comprehend Languages',
    description: 'For the duration, you understand the literal meaning of any spoken language that you hear. You also understand any written language that you see.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 1,
    classIds: [CLASS_IDS.WARLOCK],
    magicSchoolId: schoolId('DIVINATION'),
    attributes: [SPELL_ATTRIBUTE.RITUAL],
    effects: [
        {
            id: spellChildId(SPELL_IDS.COMPREHEND_LANGUAGES, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.COMPREHEND_LANGUAGES, 0x211, 1),
                    rangeKind: RANGE_KIND.SELF
                },
                targeting: {
                    selectionKind: 'SELF'
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.COMPREHEND_LANGUAGES, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.COMPREHEND_LANGUAGES, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        duration: {
                            id: spellChildId(SPELL_IDS.COMPREHEND_LANGUAGES, 0x213, 1),
                            durationKind: 'HOUR',
                            amount: 1
                        },
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.COMPREHEND_LANGUAGES, 0x212, 1),
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

