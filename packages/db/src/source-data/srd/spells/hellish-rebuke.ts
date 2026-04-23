import { ABILITY_CODE, ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, EFFECT_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SCALING, SCALING_AMOUNT_KIND, SCALING_SOURCE, SUBJECT, TARGET_SELECTION_KIND, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const hellishRebuke: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.HELLISH_REBUKE,
    label: 'Hellish Rebuke',
    description: 'You point your finger, and the creature that damaged you is momentarily surrounded by hellish flames. The creature must make a Dexterity saving throw, taking 2d10 fire damage on a failed save, or half as much damage on a successful one.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 1,
    classIds: [CLASS_IDS.WARLOCK],
    magicSchoolId: schoolId('EVOCATION'),
    effects: [
        {
            id: spellChildId(SPELL_IDS.HELLISH_REBUKE, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.SAVING_THROW,
                savingThrow: {
                    id: spellChildId(SPELL_IDS.HELLISH_REBUKE, 0x214, 1),
                    savingThrowKind: 'SOURCE_SAVE_DC',
                    ability: ABILITY_CODE.DEXTERITY
                },
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.HELLISH_REBUKE, 0x211, 1),
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
                    id: spellChildId(SPELL_IDS.HELLISH_REBUKE, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_SAVE_FAIL,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.HELLISH_REBUKE, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.HELLISH_REBUKE, 0x212, 1),
                                effectKind: EFFECT_KIND.DAMAGE,
                                damageTypeId: damageTypeId('FIRE'),
                                valueKind: 'DICE',
                                scalingKind: SCALING.PER_LEVEL,
                                scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
                                levels: [
                                    { id: spellChildId(SPELL_IDS.HELLISH_REBUKE, 0x212, 2), level: 1, order: 1, diceConfig: '2d10' },
                                    { id: spellChildId(SPELL_IDS.HELLISH_REBUKE, 0x212, 3), level: 2, order: 2, diceConfig: '3d10' },
                                    { id: spellChildId(SPELL_IDS.HELLISH_REBUKE, 0x212, 4), level: 3, order: 3, diceConfig: '4d10' },
                                    { id: spellChildId(SPELL_IDS.HELLISH_REBUKE, 0x212, 5), level: 4, order: 4, diceConfig: '5d10' },
                                    { id: spellChildId(SPELL_IDS.HELLISH_REBUKE, 0x212, 6), level: 5, order: 5, diceConfig: '6d10' },
                                    { id: spellChildId(SPELL_IDS.HELLISH_REBUKE, 0x212, 7), level: 6, order: 6, diceConfig: '7d10' },
                                    { id: spellChildId(SPELL_IDS.HELLISH_REBUKE, 0x212, 8), level: 7, order: 7, diceConfig: '8d10' },
                                    { id: spellChildId(SPELL_IDS.HELLISH_REBUKE, 0x212, 9), level: 8, order: 8, diceConfig: '9d10' },
                                    { id: spellChildId(SPELL_IDS.HELLISH_REBUKE, 0x212, 10), level: 9, order: 9, diceConfig: '10d10' }
                                ]
                            }
                        ]
                    }
                },
                {
                    id: spellChildId(SPELL_IDS.HELLISH_REBUKE, 0x216, 1),
                    order: 2,
                    pathCode: PATH_CODE.ON_SAVE_SUCCESS,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.HELLISH_REBUKE, 0x216, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.HELLISH_REBUKE, 0x216, 1),
                                effectKind: EFFECT_KIND.DAMAGE,
                                damageTypeId: damageTypeId('FIRE'),
                                amountKind: SCALING_AMOUNT_KIND.HALF,
                                valueKind: 'DICE',
                                scalingKind: SCALING.PER_LEVEL,
                                scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
                                levels: [
                                    { id: spellChildId(SPELL_IDS.HELLISH_REBUKE, 0x216, 2), level: 1, order: 1, diceConfig: '2d10' },
                                    { id: spellChildId(SPELL_IDS.HELLISH_REBUKE, 0x216, 3), level: 2, order: 2, diceConfig: '3d10' },
                                    { id: spellChildId(SPELL_IDS.HELLISH_REBUKE, 0x216, 4), level: 3, order: 3, diceConfig: '4d10' },
                                    { id: spellChildId(SPELL_IDS.HELLISH_REBUKE, 0x216, 5), level: 4, order: 4, diceConfig: '5d10' },
                                    { id: spellChildId(SPELL_IDS.HELLISH_REBUKE, 0x216, 6), level: 5, order: 5, diceConfig: '6d10' },
                                    { id: spellChildId(SPELL_IDS.HELLISH_REBUKE, 0x216, 7), level: 6, order: 6, diceConfig: '7d10' },
                                    { id: spellChildId(SPELL_IDS.HELLISH_REBUKE, 0x216, 8), level: 7, order: 7, diceConfig: '8d10' },
                                    { id: spellChildId(SPELL_IDS.HELLISH_REBUKE, 0x216, 9), level: 8, order: 8, diceConfig: '9d10' },
                                    { id: spellChildId(SPELL_IDS.HELLISH_REBUKE, 0x216, 10), level: 9, order: 9, diceConfig: '10d10' }
                                ]
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

