import { ABILITY_CODE, ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, EFFECT_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SCALING, SCALING_SOURCE, SUBJECT, TARGET_SELECTION_KIND, TARGET_DISPOSITION_KIND, TRIGGER, SPELL_COMPONENT, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const poisonSpray: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.POISON_SPRAY,
    label: 'Poison Spray',
    description: 'You extend your hand toward a creature you can see within range and project a puff of noxious gas. The creature must succeed on a Constitution saving throw or take 1d12 poison damage.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 0,
    classIds: [CLASS_IDS.DRUID, CLASS_IDS.SORCERER, CLASS_IDS.WARLOCK, CLASS_IDS.WIZARD],
    components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
    magicSchoolId: schoolId('CONJURATION'),
    effects: [
        {
            id: spellChildId(SPELL_IDS.POISON_SPRAY, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.SAVING_THROW,
                savingThrow: {
                    id: spellChildId(SPELL_IDS.POISON_SPRAY, 0x214, 1),
                    dcMethod: 'SOURCE_SAVE_DC',
                    ability: ABILITY_CODE.CONSTITUTION
                },
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.POISON_SPRAY, 0x211, 1),
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 10,
                    unit: MEASUREMENT_UNIT_CODE.FEET
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                    dispositionKind: TARGET_DISPOSITION_KIND.ANY
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.POISON_SPRAY, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_SAVE_FAIL,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.POISON_SPRAY, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.POISON_SPRAY, 0x212, 1),
                                effectKind: EFFECT_KIND.DAMAGE,
                                damageTypeId: damageTypeId('POISON'),
                                valueKind: 'DICE',
                                scalingKind: SCALING.PER_LEVEL,
                                scalingSource: SCALING_SOURCE.CHARACTER_LEVEL,
                                levels: [
                                    { id: spellChildId(SPELL_IDS.POISON_SPRAY, 0x212, 2), level: 1, order: 1, diceConfig: '1d12' },
                                    { id: spellChildId(SPELL_IDS.POISON_SPRAY, 0x212, 3), level: 5, order: 2, diceConfig: '2d12' },
                                    { id: spellChildId(SPELL_IDS.POISON_SPRAY, 0x212, 4), level: 11, order: 3, diceConfig: '3d12' },
                                    { id: spellChildId(SPELL_IDS.POISON_SPRAY, 0x212, 5), level: 17, order: 4, diceConfig: '4d12' }
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

