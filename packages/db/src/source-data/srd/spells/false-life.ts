import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, DURATION_KIND, EFFECT_KIND, RANGE_KIND, SCALING, SUBJECT, TARGET_SELECTION_KIND, TRIGGER, SPELL_COMPONENT, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const falseLife: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.FALSE_LIFE,
    label: 'False Life',
    description: 'Bolstering yourself with a necromantic facsimile of life, you gain 1d4 + 4 temporary hit points for the duration.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 1,
    classIds: [CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
    components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
    materialDescription: "a small amount of alcohol or distilled spirits",
    magicSchoolId: schoolId('NECROMANCY'),
    effects: [
        {
            id: spellChildId(SPELL_IDS.FALSE_LIFE, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.FALSE_LIFE, 0x211, 1),
                    rangeKind: RANGE_KIND.SELF
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.SELF
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.FALSE_LIFE, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.FALSE_LIFE, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        duration: {
                            id: spellChildId(SPELL_IDS.FALSE_LIFE, 0x213, 1),
                            durationKind: DURATION_KIND.HOUR,
                            amount: 1
                        },
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.FALSE_LIFE, 0x212, 1),
                                effectKind: EFFECT_KIND.HEAL,
                                temporary: true,
                                valueKind: 'DICE',
                                scalingKind: SCALING.NONE,
                                diceConfig: '1d4+4'
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

