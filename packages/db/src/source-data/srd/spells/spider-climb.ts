import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, DURATION_KIND, EFFECT_KIND, RANGE_KIND, SPELL_ATTRIBUTE, SUBJECT, TARGET_DISPOSITION_KIND, TARGET_SELECTION_KIND, TRIGGER, SPELL_COMPONENT, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const spiderClimb: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.SPIDER_CLIMB,
    label: 'Spider Climb',
    description: 'Until the spell ends, one willing creature you touch gains the ability to move up, down, and across vertical surfaces and upside down along ceilings, while leaving its hands free.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 2,
    classIds: [CLASS_IDS.SORCERER, CLASS_IDS.WARLOCK, CLASS_IDS.WIZARD],
    components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
    materialDescription: "a drop of bitumen and a spider",
    magicSchoolId: schoolId('TRANSMUTATION'),
    attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
    effects: [
        {
            id: spellChildId(SPELL_IDS.SPIDER_CLIMB, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.SPIDER_CLIMB, 0x211, 1),
                    rangeKind: RANGE_KIND.TOUCH
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                    dispositionKind: TARGET_DISPOSITION_KIND.WILLING
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.SPIDER_CLIMB, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.SPIDER_CLIMB, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        duration: {
                            id: spellChildId(SPELL_IDS.SPIDER_CLIMB, 0x213, 1),
                            durationKind: DURATION_KIND.HOUR,
                            amount: 1
                        },
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.SPIDER_CLIMB, 0x212, 1),
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

