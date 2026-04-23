import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, EFFECT_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SHAPE_KIND, SUBJECT, TARGET_SELECTION_KIND, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { SRD_MAGIC_SCHOOLS, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js';
import { spellChildId } from './shared.js';
function schoolId(code: string): string {
    const entry = SRD_MAGIC_SCHOOLS.find((s) => s.code === code);
    if (!entry)
        throw new Error(`SRD magic school vocabulary entry for ${code} required for spell source data.`);
    return entry.id;
}
export const hungerOfHadar: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.HUNGER_OF_HADAR,
    label: 'Hunger of Hadar',
    description: 'You open a gateway to the dark between the stars, a region infested with unknown horrors. A 20-foot-radius sphere of blackness and bitter cold appears, centered on a point with range and lasting for the duration.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 3,
    classIds: [CLASS_IDS.WARLOCK],
    magicSchoolId: schoolId('CONJURATION'),
    effects: [
        {
            id: spellChildId(SPELL_IDS.HUNGER_OF_HADAR, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.HUNGER_OF_HADAR, 0x211, 1),
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 150,
                    unit: MEASUREMENT_UNIT_CODE.FEET
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS
                },
                shape: {
                    id: spellChildId(SPELL_IDS.HUNGER_OF_HADAR, 0x212, 1),
                    shapeKind: SHAPE_KIND.SPHERE,
                    radius: {
                        amount: 20,
                        unit: MEASUREMENT_UNIT_CODE.FEET
                    }
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.HUNGER_OF_HADAR, 0x213, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.HUNGER_OF_HADAR, 0x213, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.HUNGER_OF_HADAR, 0x213, 1),
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

