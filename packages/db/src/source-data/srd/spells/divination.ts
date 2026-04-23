import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, EFFECT_KIND, RANGE_KIND, SPELL_ATTRIBUTE, SUBJECT, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const divination: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.DIVINATION,
    label: 'Divination',
    description: "Your magic and an offering put you in contact with a god or a god's servants. You ask a single question concerning a specific goal, event, or activity to occur within 7 days.",
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 4,
    classIds: [CLASS_IDS.CLERIC],
    magicSchoolId: schoolId('DIVINATION'),
    attributes: [SPELL_ATTRIBUTE.RITUAL],
    effects: [
        {
            id: spellChildId(SPELL_IDS.DIVINATION, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.DIVINATION, 0x211, 1),
                    rangeKind: RANGE_KIND.SELF
                },
                targeting: {
                    selectionKind: 'SELF'
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.DIVINATION, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.DIVINATION, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.DIVINATION, 0x212, 1),
                                effectKind: EFFECT_KIND.RULE
                            }
                        ]
                    }
                }
            ]
        }
    ],
    materialDescription: "incense and a sacrificial offering appropriate to your religion worth at least 25 gp, consumed by the spell",
    userId: SRD_USER_ID,
    systemId: SRD_SYSTEM_ID,
};

