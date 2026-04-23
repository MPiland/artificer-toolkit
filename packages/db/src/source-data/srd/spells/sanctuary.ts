import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, DURATION_KIND, EFFECT_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SUBJECT, TARGET_DISPOSITION_KIND, TARGET_SELECTION_KIND, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const sanctuary: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.SANCTUARY,
    label: 'Sanctuary',
    description: 'You ward a creature within range against attack. Until the spell ends, a creature that targets the warded creature with an attack or harmful spell must first make a Wisdom saving throw.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 1,
    classIds: [CLASS_IDS.CLERIC],
    magicSchoolId: schoolId('ABJURATION'),
    userId: SRD_USER_ID,
    systemId: SRD_SYSTEM_ID,
    effects: [
        {
            id: spellChildId(SPELL_IDS.SANCTUARY, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.BONUS_ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.SANCTUARY, 0x211, 1),
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 30,
                    unit: MEASUREMENT_UNIT_CODE.FEET
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                    dispositionKind: TARGET_DISPOSITION_KIND.WILLING
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.SANCTUARY, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.SANCTUARY, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.SANCTUARY, 0x212, 1),
                                effectKind: EFFECT_KIND.RULE
                            }
                        ]
                    }
                }
            ]
        }
    ]
};

