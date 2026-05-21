import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, DURATION_KIND, EFFECT_KIND, RANGE_KIND, SUBJECT, TARGET_SELECTION_KIND, TARGET_DISPOSITION_KIND, TRIGGER, SPELL_COMPONENT, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const etherealness: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.ETHEREALNESS,
    label: 'Etherealness',
    description: 'You step into the border regions of the Ethereal Plane, in the area where it overlaps with your current plane. You remain in the Border Ethereal for the duration or until you use your action to dismiss the spell.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 7,
    classIds: [CLASS_IDS.BARD, CLASS_IDS.CLERIC, CLASS_IDS.SORCERER, CLASS_IDS.WARLOCK, CLASS_IDS.WIZARD],
    components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
    magicSchoolId: schoolId('TRANSMUTATION'),
    effects: [
        {
            id: spellChildId(SPELL_IDS.ETHEREALNESS, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.ETHEREALNESS, 0x211, 1),
                    rangeKind: RANGE_KIND.SELF
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                    dispositionKind: TARGET_DISPOSITION_KIND.ANY
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.ETHEREALNESS, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.ETHEREALNESS, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        duration: {
                            id: spellChildId(SPELL_IDS.ETHEREALNESS, 0x213, 1),
                            durationKind: DURATION_KIND.HOUR,
                            amount: 8
                        },
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.ETHEREALNESS, 0x212, 1),
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

