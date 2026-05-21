import { ACTIVATION_CODE, CASTING_TIME_UNIT_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, DURATION_KIND, EFFECT_KIND, RANGE_KIND, SUBJECT, TARGET_SELECTION_KIND, TARGET_DISPOSITION_KIND, TRIGGER, SPELL_COMPONENT, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const resurrection: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.RESURRECTION,
    label: 'Resurrection',
    description: 'You touch a dead creature that has been dead for no more than a century and did not die of old age. If its soul is willing and free, the target returns to life with all its hit points.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.HOUR, amount: 1 },
    level: 7,
    classIds: [CLASS_IDS.BARD, CLASS_IDS.CLERIC],
    components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
    materialDescription: "a diamond worth at least 1,000 gp, which the spell consumes",
    magicSchoolId: schoolId('NECROMANCY'),
    effects: [
        {
            id: spellChildId(SPELL_IDS.RESURRECTION, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.RESURRECTION, 0x211, 1),
                    rangeKind: RANGE_KIND.TOUCH
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                    dispositionKind: TARGET_DISPOSITION_KIND.ANY
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.RESURRECTION, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.RESURRECTION, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        duration: {
                            id: spellChildId(SPELL_IDS.RESURRECTION, 0x213, 1),
                            durationKind: DURATION_KIND.INSTANTANEOUS
                        },
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.RESURRECTION, 0x212, 1),
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

