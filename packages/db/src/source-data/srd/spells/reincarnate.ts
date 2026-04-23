import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, EFFECT_KIND, RANGE_KIND, SUBJECT, TARGET_SELECTION_KIND, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const reincarnate: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.REINCARNATE,
    label: 'Reincarnate',
    description: 'You touch a dead humanoid and form a new adult body for it, calling the soul back to life in a randomly determined new race if the soul is free and willing.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.HOUR, amount: 1 },
    level: 5,
    classIds: [CLASS_IDS.DRUID],
    magicSchoolId: schoolId('TRANSMUTATION'),
    effects: [
        {
            id: spellChildId(SPELL_IDS.REINCARNATE, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.REINCARNATE, 0x211, 1),
                    rangeKind: RANGE_KIND.TOUCH
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.REINCARNATE, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.REINCARNATE, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.REINCARNATE, 0x212, 1),
                                effectKind: EFFECT_KIND.RULE
                            }
                        ]
                    }
                }
            ]
        }
    ],
    materialDescription: 'rare oils and unguents worth at least 1,000 gp, which the spell consumes',
    userId: SRD_USER_ID,
    systemId: SRD_SYSTEM_ID
};

