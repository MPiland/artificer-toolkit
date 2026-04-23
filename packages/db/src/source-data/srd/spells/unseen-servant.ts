import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, DURATION_KIND, EFFECT_KIND, MANIFEST_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SPELL_ATTRIBUTE, SUBJECT, TARGET_SELECTION_KIND, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const unseenServant: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.UNSEEN_SERVANT,
    label: 'Unseen Servant',
    description: 'This spell creates an invisible, mindless, shapeless force that performs simple tasks at your command until the spell ends. It can perform simple tasks like cleaning, mending, folding, cooking, or the like.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 1,
    classIds: [CLASS_IDS.WARLOCK],
    magicSchoolId: schoolId('CONJURATION'),
    attributes: [SPELL_ATTRIBUTE.RITUAL],
    effects: [
        {
            id: spellChildId(SPELL_IDS.UNSEEN_SERVANT, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.UNSEEN_SERVANT, 0x211, 1),
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 60,
                    unit: MEASUREMENT_UNIT_CODE.FEET
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.UNSEEN_SERVANT, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.UNSEEN_SERVANT, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        duration: {
                            id: spellChildId(SPELL_IDS.UNSEEN_SERVANT, 0x213, 1),
                            durationKind: DURATION_KIND.HOUR,
                            amount: 1
                        },
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.UNSEEN_SERVANT, 0x212, 1),
                                effectKind: EFFECT_KIND.MANIFEST,
                                manifestKind: MANIFEST_KIND.OBJECT
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

