import { ACTIVATION_CODE, ABILITY_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, EFFECT_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, TARGET_SELECTION_KIND, SCALING, SCALING_SOURCE, SUBJECT, TRIGGER, SPELL_COMPONENT, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const acidSplash: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.ACID_SPLASH,
    label: 'Acid Splash',
    description: 'You hurl a bubble of acid. Choose one or two creatures you can see within range. If you choose two creatures, they must be within 5 feet of each other. A target must succeed on a Dexterity saving throw or take 1d6 acid damage.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 0,
    classIds: [CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
    components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
    magicSchoolId: schoolId('CONJURATION'),
    effects: [
        {
            id: spellChildId(SPELL_IDS.ACID_SPLASH, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.SAVING_THROW,
                savingThrow: {
                    id: spellChildId(SPELL_IDS.ACID_SPLASH, 0x214, 1),
                    savingThrowKind: 'SOURCE_SAVE_DC',
                    ability: ABILITY_CODE.DEXTERITY
                },
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.ACID_SPLASH, 0x211, 1),
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 60,
                    unit: MEASUREMENT_UNIT_CODE.FEET
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
                    maxTargets: 2
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.ACID_SPLASH, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_SAVE_FAIL,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.ACID_SPLASH, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.ACID_SPLASH, 0x212, 1),
                                effectKind: EFFECT_KIND.DAMAGE,
                                damageTypeId: damageTypeId('ACID'),
                                valueKind: 'DICE',
                                scalingKind: SCALING.PER_LEVEL,
                                scalingSource: SCALING_SOURCE.CHARACTER_LEVEL,
                                levels: [
                                    { id: spellChildId(SPELL_IDS.ACID_SPLASH, 0x212, 2), level: 1, order: 1, diceConfig: '1d6' },
                                    { id: spellChildId(SPELL_IDS.ACID_SPLASH, 0x212, 3), level: 5, order: 2, diceConfig: '2d6' },
                                    { id: spellChildId(SPELL_IDS.ACID_SPLASH, 0x212, 4), level: 11, order: 3, diceConfig: '3d6' },
                                    { id: spellChildId(SPELL_IDS.ACID_SPLASH, 0x212, 5), level: 17, order: 4, diceConfig: '4d6' }
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

