import { ABILITY_CODE, ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, EFFECT_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SCALING_AMOUNT_KIND, SUBJECT, TARGET_SELECTION_KIND, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const harm: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.HARM,
    label: 'Harm',
    description: 'You unleash a virulent disease on a creature that you can see within range. The target must make a Constitution saving throw. On a failed save, it takes 14d6 necrotic damage, and its hit point maximum is reduced by the amount of necrotic damage taken.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 6,
    classIds: [CLASS_IDS.CLERIC],
    magicSchoolId: schoolId('NECROMANCY'),
    effects: [
        {
            id: spellChildId(SPELL_IDS.HARM, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.SAVING_THROW,
                savingThrow: {
                    id: spellChildId(SPELL_IDS.HARM, 0x211, 1),
                    savingThrowKind: 'SOURCE_SAVE_DC',
                    ability: ABILITY_CODE.CONSTITUTION
                },
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.HARM, 0x212, 1),
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 60,
                    unit: MEASUREMENT_UNIT_CODE.FEET
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.HARM, 0x213, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_SAVE_FAIL,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.HARM, 0x213, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.HARM, 0x213, 1),
                                effectKind: EFFECT_KIND.DAMAGE,
                                damageTypeId: damageTypeId('NECROTIC'),
                                valueKind: 'DICE',
                                scalingKind: 'NONE',
                                diceConfig: '14d6'
                            }
                        ]
                    }
                },
                {
                    id: spellChildId(SPELL_IDS.HARM, 0x214, 1),
                    order: 2,
                    pathCode: PATH_CODE.ON_SAVE_SUCCESS,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.HARM, 0x214, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.HARM, 0x214, 1),
                                effectKind: EFFECT_KIND.DAMAGE,
                                damageTypeId: damageTypeId('NECROTIC'),
                                amountKind: SCALING_AMOUNT_KIND.HALF,
                                valueKind: 'DICE',
                                scalingKind: 'NONE',
                                diceConfig: '14d6'
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

