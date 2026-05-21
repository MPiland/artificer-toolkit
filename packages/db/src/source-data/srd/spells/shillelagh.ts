import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, DURATION_KIND, EFFECT_KIND, RANGE_KIND, SUBJECT, TARGET_SELECTION_KIND, TARGET_DISPOSITION_KIND, TRIGGER, SPELL_COMPONENT, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const shillelagh: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.SHILLELAGH,
    label: 'Shillelagh',
    description: "The wood of a club or quarterstaff you are holding is imbued with nature's power. For the duration, you can use your spellcasting ability instead of Strength for attack and damage rolls made with that weapon.",
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 0,
    classIds: [CLASS_IDS.DRUID],
    components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
    materialDescription: "mistletoe, a shamrock leaf, and a club or quarterstaff",
    magicSchoolId: schoolId('TRANSMUTATION'),
    effects: [
        {
            id: spellChildId(SPELL_IDS.SHILLELAGH, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.BONUS_ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.SHILLELAGH, 0x211, 1),
                    rangeKind: RANGE_KIND.TOUCH
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                    dispositionKind: TARGET_DISPOSITION_KIND.ANY
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.SHILLELAGH, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.SHILLELAGH, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        duration: {
                            id: spellChildId(SPELL_IDS.SHILLELAGH, 0x213, 1),
                            durationKind: DURATION_KIND.MINUTE,
                            amount: 1
                        },
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.SHILLELAGH, 0x212, 1),
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

