import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, DURATION_KIND, EFFECT_KIND, RANGE_KIND, SPELL_ATTRIBUTE, SUBJECT, TARGET_DISPOSITION_KIND, TARGET_SELECTION_KIND, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { SRD_MAGIC_SCHOOLS, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js';
import { spellChildId } from './shared.js';
function schoolId(code: string): string {
    const entry = SRD_MAGIC_SCHOOLS.find((s) => s.code === code);
    if (!entry) {
        throw new Error(`SRD magic school vocabulary entry for ${code} required for spell source data.`);
    }
    return entry.id;
}
export const feignDeath: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.FEIGN_DEATH,
    label: 'Feign Death',
    description: "You touch a willing creature and put it into a cataleptic state that is indistinguishable from death. For the spell's duration, or until you use an action to touch the target and dismiss the spell, the target appears dead to all outward inspection.",
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 3,
    classIds: [CLASS_IDS.BARD, CLASS_IDS.CLERIC, CLASS_IDS.DRUID, CLASS_IDS.WIZARD],
    magicSchoolId: schoolId('NECROMANCY'),
    attributes: [SPELL_ATTRIBUTE.RITUAL],
    effects: [
        {
            id: spellChildId(SPELL_IDS.FEIGN_DEATH, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.FEIGN_DEATH, 0x211, 1),
                    rangeKind: RANGE_KIND.TOUCH
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                    dispositionKind: TARGET_DISPOSITION_KIND.WILLING
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.FEIGN_DEATH, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.FEIGN_DEATH, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        duration: {
                            id: spellChildId(SPELL_IDS.FEIGN_DEATH, 0x213, 1),
                            durationKind: DURATION_KIND.HOUR,
                            amount: 1
                        },
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.FEIGN_DEATH, 0x212, 1),
                                effectKind: EFFECT_KIND.RULE
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

