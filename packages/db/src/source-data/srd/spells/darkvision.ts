import { ACTIVATION_CODE, AUTHORING_MODE_KIND, AUTHORING_SELECTION_KIND, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, DURATION_KIND, EFFECT_KIND, GRANT_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SCALING, SUBJECT, TARGET_DISPOSITION_KIND, TARGET_SELECTION_KIND, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { SRD_DARKVISION_SENSE_ID } from '../vocabulary.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const darkvision: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.DARKVISION,
    label: 'Darkvision',
    description: 'You touch a willing creature to grant it the ability to see in the dark. For the duration, that creature has darkvision out to a range of 60 feet.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 2,
    classIds: [CLASS_IDS.DRUID, CLASS_IDS.RANGER, CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
    magicSchoolId: schoolId('TRANSMUTATION'),
    effects: [
        {
            id: spellChildId(SPELL_IDS.DARKVISION, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.DARKVISION, 0x211, 1),
                    rangeKind: RANGE_KIND.TOUCH
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                    dispositionKind: TARGET_DISPOSITION_KIND.WILLING
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.DARKVISION, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.DARKVISION, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        duration: {
                            id: spellChildId(SPELL_IDS.DARKVISION, 0x213, 1),
                            durationKind: DURATION_KIND.HOUR,
                            amount: 8
                        },
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.DARKVISION, 0x212, 1),
                                effectKind: EFFECT_KIND.APPLY_GRANT,
                                grants: {
                                    senses: [
                                        {
                                            id: spellChildId(SPELL_IDS.DARKVISION, 0x214, 1),
                                            grantKind: GRANT_KIND.SENSE_GRANT,
                                            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                                            scalingKind: SCALING.NONE,
                                            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                                            senseIds: [SRD_DARKVISION_SENSE_ID],
                                            range: {
                                                id: spellChildId(SPELL_IDS.DARKVISION, 0x215, 1),
                                                rangeKind: RANGE_KIND.DISTANCE,
                                                amount: 60,
                                                unit: MEASUREMENT_UNIT_CODE.FEET
                                            },
                                            order: 1
                                        }
                                    ]
                                }
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

