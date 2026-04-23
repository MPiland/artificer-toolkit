import { ABILITY_CODE, ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, EFFECT_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SUBJECT, TARGET_SELECTION_KIND, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const sunburst: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.SUNBURST,
    label: 'Sunburst',
    description: 'A burst of brilliant sunlight explodes in a 60-foot radius at a point within range, dealing radiant damage and potentially blinding creatures caught in the flash.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 8,
    classIds: [CLASS_IDS.DRUID, CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
    magicSchoolId: schoolId('EVOCATION'),
    materialDescription: 'fire and a piece of sunstone',
    effects: [
        {
            id: spellChildId(SPELL_IDS.SUNBURST, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.SAVING_THROW,
                savingThrow: {
                    id: spellChildId(SPELL_IDS.SUNBURST, 0x211, 1),
                    savingThrowKind: 'SOURCE_SAVE_DC',
                    ability: ABILITY_CODE.CONSTITUTION
                },
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.SUNBURST, 0x212, 1),
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 150,
                    unit: MEASUREMENT_UNIT_CODE.FEET
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.SUNBURST, 0x213, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_SAVE_FAIL,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.SUNBURST, 0x213, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.SUNBURST, 0x213, 1),
                                effectKind: EFFECT_KIND.RULE
                            }
                        ]
                    }
                },
                {
                    id: spellChildId(SPELL_IDS.SUNBURST, 0x214, 1),
                    order: 2,
                    pathCode: PATH_CODE.ON_SAVE_SUCCESS,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.SUNBURST, 0x214, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.SUNBURST, 0x214, 1),
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

