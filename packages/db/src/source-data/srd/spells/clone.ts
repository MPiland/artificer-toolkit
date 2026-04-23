import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, EFFECT_KIND, RANGE_KIND, SUBJECT, TARGET_SELECTION_KIND, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const clone: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.CLONE,
    label: 'Clone',
    description: 'This spell grows an inert duplicate of a living creature as a safeguard against death. This clone forms inside a sealed vessel and grows to full size and maturity after 120 days.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.HOUR, amount: 1 },
    level: 8,
    classIds: [CLASS_IDS.WIZARD],
    magicSchoolId: schoolId('NECROMANCY'),
    materialDescription: 'a diamond worth at least 1,000 gp and at least 1 cubic inch of flesh of the creature to be cloned, and a vessel worth at least 2,000 gp',
    effects: [
        {
            id: spellChildId(SPELL_IDS.CLONE, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.CLONE, 0x211, 1),
                    rangeKind: RANGE_KIND.SPECIAL
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.CLONE, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.CLONE, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.CLONE, 0x212, 1),
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

