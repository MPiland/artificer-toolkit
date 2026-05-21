import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, EFFECT_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SUBJECT, TARGET_SELECTION_KIND, TARGET_DISPOSITION_KIND, TRIGGER, SPELL_COMPONENT, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { SRD_MAGIC_SCHOOLS, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js';
import { spellChildId } from './shared.js';
function schoolId(code: string): string {
    const entry = SRD_MAGIC_SCHOOLS.find((s) => s.code === code);
    if (!entry)
        throw new Error(`SRD magic school vocabulary entry for ${code} required for spell source data.`);
    return entry.id;
}
export const thaumaturgy: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.THAUMATURGY,
    label: 'Thaumaturgy',
    description: 'You manifest a minor wonder, a sign of supernatural power, within range. You create one of the following magical effects within range: your voice booms up to three times as loud as normal for 1 minute; you cause flames to flicker, brighten, dim, or change color for 1 minute; you cause harmless tremors in the ground for 1 minute; you create an instantaneous sound that originates from a point of your choice within range, such as a rumble of thunder, the cry of a raven, or ominous whispers; you instantaneously cause an unlocked door or window to fly open or slam shut; you alter the appearance of your eyes for 1 minute.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 0,
    classIds: [CLASS_IDS.CLERIC],
    components: [SPELL_COMPONENT.VERBAL],
    magicSchoolId: schoolId('TRANSMUTATION'),
    effects: [
        {
            id: spellChildId(SPELL_IDS.THAUMATURGY, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.THAUMATURGY, 0x211, 1),
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 30,
                    unit: MEASUREMENT_UNIT_CODE.FEET
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                    dispositionKind: TARGET_DISPOSITION_KIND.ANY
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.THAUMATURGY, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.THAUMATURGY, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.THAUMATURGY, 0x212, 1),
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

