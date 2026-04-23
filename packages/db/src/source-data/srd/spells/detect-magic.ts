import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, EFFECT_KIND, RANGE_KIND, SPELL_ATTRIBUTE, SUBJECT, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const detectMagic: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.DETECT_MAGIC,
    label: 'Detect Magic',
    description: 'For the duration, you sense the presence of magic within 30 feet of you. If you sense magic in this way, you can use your action to see a faint aura around any visible creature or object in the area that bears magic.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 1,
    classIds: [CLASS_IDS.WARLOCK],
    magicSchoolId: schoolId('DIVINATION'),
    attributes: [SPELL_ATTRIBUTE.RITUAL, SPELL_ATTRIBUTE.CONCENTRATION],
    effects: [
        {
            id: spellChildId(SPELL_IDS.DETECT_MAGIC, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.DETECT_MAGIC, 0x211, 1),
                    rangeKind: RANGE_KIND.SELF
                },
                targeting: {
                    selectionKind: 'AREA_CONTENTS'
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.DETECT_MAGIC, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.DETECT_MAGIC, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        duration: {
                            id: spellChildId(SPELL_IDS.DETECT_MAGIC, 0x213, 1),
                            durationKind: 'MINUTE',
                            amount: 10
                        },
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.DETECT_MAGIC, 0x212, 1),
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

