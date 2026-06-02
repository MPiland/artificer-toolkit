import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, EFFECT_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SCALING, SCALING_SOURCE, SUBJECT, TARGET_SELECTION_KIND, TARGET_DISPOSITION_KIND, TRIGGER, SPELL_COMPONENT, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const magicMissile: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.MAGIC_MISSILE,
    label: 'Magic Missile',
    description: '<p>You create three glowing darts of magical force. Each dart hits a creature of your choice that you can see within range. A dart deals 1d4 + 1 force damage to its target. The darts all strike simultaneously, and you can direct them to hit one creature or several.</p><p><strong>At Higher Levels.</strong> When you cast this spell using a spell slot of 2nd level or higher, the spell creates one more dart for each slot level above 1st.</p>',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 1,
    classIds: [CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
    components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
    magicSchoolId: schoolId('EVOCATION'),
    effects: [
        {
            id: spellChildId(SPELL_IDS.MAGIC_MISSILE, 0x210, 1),
            order: 1,
            invocation: {
                kind: 'ACTION' as const,
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.MAGIC_MISSILE, 0x211, 1),
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 120,
                    unit: MEASUREMENT_UNIT_CODE.FEET
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
                    dispositionKind: TARGET_DISPOSITION_KIND.ANY,
                    maxTargets: 3
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.MAGIC_MISSILE, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    originKind: 'SOURCE' as const,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.MAGIC_MISSILE, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.MAGIC_MISSILE, 0x212, 1),
                                effectKind: EFFECT_KIND.DAMAGE,
                                damageTypeId: damageTypeId('FORCE'),
                                valueKind: 'DICE',
                                scalingKind: SCALING.PER_LEVEL,
                                scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
                                levels: [
                                    { id: spellChildId(SPELL_IDS.MAGIC_MISSILE, 0x212, 2), level: 1, order: 1, diceConfig: '3d4+3' },
                                    { id: spellChildId(SPELL_IDS.MAGIC_MISSILE, 0x212, 3), level: 2, order: 2, diceConfig: '4d4+4' },
                                    { id: spellChildId(SPELL_IDS.MAGIC_MISSILE, 0x212, 4), level: 3, order: 3, diceConfig: '5d4+5' },
                                    { id: spellChildId(SPELL_IDS.MAGIC_MISSILE, 0x212, 5), level: 4, order: 4, diceConfig: '6d4+6' },
                                    { id: spellChildId(SPELL_IDS.MAGIC_MISSILE, 0x212, 6), level: 5, order: 5, diceConfig: '7d4+7' },
                                    { id: spellChildId(SPELL_IDS.MAGIC_MISSILE, 0x212, 7), level: 6, order: 6, diceConfig: '8d4+8' },
                                    { id: spellChildId(SPELL_IDS.MAGIC_MISSILE, 0x212, 8), level: 7, order: 7, diceConfig: '9d4+9' },
                                    { id: spellChildId(SPELL_IDS.MAGIC_MISSILE, 0x212, 9), level: 8, order: 8, diceConfig: '10d4+10' },
                                    { id: spellChildId(SPELL_IDS.MAGIC_MISSILE, 0x212, 10), level: 9, order: 9, diceConfig: '11d4+11' }
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

