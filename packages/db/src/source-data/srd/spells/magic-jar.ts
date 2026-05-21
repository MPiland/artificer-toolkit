import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, EFFECT_KIND, RANGE_KIND, SUBJECT, TARGET_SELECTION_KIND, TRIGGER, SPELL_COMPONENT, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { SRD_MAGIC_SCHOOLS, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js';
import { spellChildId } from './shared.js';
function schoolId(code: string): string {
    const entry = SRD_MAGIC_SCHOOLS.find((s) => s.code === code);
    if (!entry)
        throw new Error(`SRD magic school vocabulary entry for ${code} required for spell source data.`);
    return entry.id;
}
export const magicJar: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.MAGIC_JAR,
    label: 'Magic Jar',
    description: 'Your body falls into a catatonic state as your soul leaves it and enters the container you used for the spell\'s material component. While your soul inhabits the container, you are aware of your surroundings as if you were in the container\'s space.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.MINUTE, amount: 1 },
    level: 6,
    classIds: [CLASS_IDS.WIZARD],
    components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
    materialDescription: "a gem, crystal, reliquary, or some other ornamental container worth at least 500 gp",
    magicSchoolId: schoolId('NECROMANCY'),
    effects: [
        {
            id: spellChildId(SPELL_IDS.MAGIC_JAR, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.MAGIC_JAR, 0x211, 1),
                    rangeKind: RANGE_KIND.SPECIAL
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.SELF
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.MAGIC_JAR, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.MAGIC_JAR, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.MAGIC_JAR, 0x212, 1),
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

