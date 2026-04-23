import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, DURATION_KIND, EFFECT_KIND, MANIFEST_KIND, MEASUREMENT_UNIT_CODE, NUMERIC_EXPR_CODE, RANGE_KIND, SIZE_CODE, SPELL_ATTRIBUTE, SUBJECT, TARGET_SELECTION_KIND, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const arcaneHand: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.ARCANE_HAND,
    label: 'Arcane Hand',
    description: "You create a Large hand of shimmering, translucent force in an unoccupied space that you can see within range. The hand lasts for the spell's duration, and it moves at your command, mimicking the movements of your own hand.",
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 5,
    classIds: [CLASS_IDS.WIZARD],
    magicSchoolId: schoolId('EVOCATION'),
    attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
    effects: [
        {
            id: spellChildId(SPELL_IDS.ARCANE_HAND, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.ARCANE_HAND, 0x211, 1),
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 120,
                    unit: MEASUREMENT_UNIT_CODE.FEET
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.ARCANE_HAND, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.ARCANE_HAND, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        duration: {
                            id: spellChildId(SPELL_IDS.ARCANE_HAND, 0x213, 1),
                            durationKind: DURATION_KIND.MINUTE,
                            amount: 1
                        },
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.ARCANE_HAND, 0x212, 1),
                                effectKind: EFFECT_KIND.MANIFEST,
                                manifestKind: MANIFEST_KIND.SUMMON,
                                statBlock: {
                                    size: SIZE_CODE.LARGE,
                                    armorClass: {
                                        kind: NUMERIC_EXPR_CODE.FIXED,
                                        value: 20
                                    },
                                    hitPoints: {
                                        kind: NUMERIC_EXPR_CODE.HIT_POINT_MAXIMUM
                                    },
                                    speeds: [
                                        {
                                            speedId: spellChildId(SPELL_IDS.ARCANE_HAND, 0x214, 1),
                                            amount: 60,
                                            unit: MEASUREMENT_UNIT_CODE.FEET
                                        }
                                    ],
                                    abilityScores: {
                                        STRENGTH: {
                                            kind: NUMERIC_EXPR_CODE.FIXED,
                                            value: 26
                                        }
                                    },
                                    damageabilityKind: 'NORMAL',
                                    occupiesSpace: true
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

