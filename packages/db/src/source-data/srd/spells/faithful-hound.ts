import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, DURATION_KIND, EFFECT_KIND, MANIFEST_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SUBJECT, TARGET_SELECTION_KIND, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const faithfulHound: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.FAITHFUL_HOUND,
    label: 'Faithful Hound',
    description: 'You conjure a phantom guardian in an unoccupied space you choose within range. The hound remains on guard and reacts to intruders while the spell lasts.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 4,
    classIds: [CLASS_IDS.WIZARD],
    magicSchoolId: schoolId('CONJURATION'),
    effects: [
        {
            id: spellChildId(SPELL_IDS.FAITHFUL_HOUND, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.FAITHFUL_HOUND, 0x211, 1),
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 30,
                    unit: MEASUREMENT_UNIT_CODE.FEET
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.FAITHFUL_HOUND, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.FAITHFUL_HOUND, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        duration: {
                            id: spellChildId(SPELL_IDS.FAITHFUL_HOUND, 0x213, 1),
                            durationKind: DURATION_KIND.HOUR,
                            amount: 8
                        },
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.FAITHFUL_HOUND, 0x212, 1),
                                effectKind: EFFECT_KIND.MANIFEST,
                                manifestKind: MANIFEST_KIND.SUMMON,
                                behaviors: [
                                    {
                                        id: spellChildId(SPELL_IDS.FAITHFUL_HOUND, 0x214, 1),
                                        order: 1,
                                        invocation: {
                                            triggerCode: TRIGGER.ENTER_AREA,
                                            activation: {
                                                code: ACTIVATION_CODE.FREE
                                            },
                                            range: {
                                                id: spellChildId(SPELL_IDS.FAITHFUL_HOUND, 0x215, 1),
                                                rangeKind: RANGE_KIND.SPECIAL
                                            },
                                            targeting: {
                                                selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS
                                            }
                                        },
                                        paths: [
                                            {
                                                id: spellChildId(SPELL_IDS.FAITHFUL_HOUND, 0x216, 1),
                                                order: 1,
                                                pathCode: PATH_CODE.PASSIVE,
                                                groupType: PATH_GROUP_TYPE.SINGLE,
                                                selectionKind: "FIXED" as const,
                                                resultBlock: {
                                                    id: spellChildId(SPELL_IDS.FAITHFUL_HOUND, 0x216, 1) + "__result",
                                                    resultKind: "SINGLE" as const,
                                                    outcomes: [
                                                        {
                                                            id: spellChildId(SPELL_IDS.FAITHFUL_HOUND, 0x216, 1),
                                                            effectKind: EFFECT_KIND.RULE
                                                        }
                                                    ]
                                                }
                                            }
                                        ]
                                    }
                                ]
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

