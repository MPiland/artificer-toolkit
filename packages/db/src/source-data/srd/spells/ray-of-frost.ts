import { ACTIVATION_CODE, AUTHORING_SELECTION_KIND, CASTING_TIME_UNIT_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, DURATION_KIND, EFFECT_KIND, GRANT_KIND, MEASUREMENT_UNIT_CODE, MODIFIER_KIND, MODIFIER_SCOPE_KIND, RANGE_KIND, SCALING, SCALING_SOURCE, TARGET_SELECTION_KIND, TARGET_DISPOSITION_KIND, SUBJECT, TRIGGER, VALUE_DOMAIN_CODE, SPELL_COMPONENT, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { SRD_SPEEDS } from '../vocabulary.js';
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
const walkSpeedId = SRD_SPEEDS.find((speed) => speed.code === 'WALK')?.id;
if (!walkSpeedId)
    throw new Error('SRD WALK speed vocabulary entry is required for spell source data.');
export const rayOfFrost: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.RAY_OF_FROST,
    label: 'Ray of Frost',
    description: 'A frigid beam of blue-white light streaks toward a creature within range. On a hit, it takes cold damage and its speed is reduced until the start of your next turn.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 0,
    classIds: [CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
    components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
    magicSchoolId: schoolId('EVOCATION'),
    effects: [
        {
            id: spellChildId(SPELL_IDS.RAY_OF_FROST, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.SPELL_ATTACK,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.RAY_OF_FROST, 0x211, 1),
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 60,
                    unit: MEASUREMENT_UNIT_CODE.FEET
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                    dispositionKind: TARGET_DISPOSITION_KIND.ANY
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.RAY_OF_FROST, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_HIT,
                    groupType: PATH_GROUP_TYPE.SEQUENTIAL,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.RAY_OF_FROST, 0x212, 1) + "__result",
                        resultKind: "SEQUENCE" as const,
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.RAY_OF_FROST, 0x212, 1),
                                effectKind: EFFECT_KIND.DAMAGE,
                                damageTypeId: damageTypeId('COLD'),
                                valueKind: 'DICE',
                                scalingKind: SCALING.PER_LEVEL,
                                scalingSource: SCALING_SOURCE.CHARACTER_LEVEL,
                                levels: [
                                    { id: spellChildId(SPELL_IDS.RAY_OF_FROST, 0x212, 2), level: 1, order: 1, diceConfig: '1d8' },
                                    { id: spellChildId(SPELL_IDS.RAY_OF_FROST, 0x212, 3), level: 5, order: 2, diceConfig: '2d8' },
                                    { id: spellChildId(SPELL_IDS.RAY_OF_FROST, 0x212, 4), level: 11, order: 3, diceConfig: '3d8' },
                                    { id: spellChildId(SPELL_IDS.RAY_OF_FROST, 0x212, 5), level: 17, order: 4, diceConfig: '4d8' }
                                ]
                            }
                        ]
                    }
                },
                {
                    id: spellChildId(SPELL_IDS.RAY_OF_FROST, 0x213, 1),
                    order: 2,
                    pathCode: PATH_CODE.ON_HIT,
                    groupType: PATH_GROUP_TYPE.SEQUENTIAL,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.RAY_OF_FROST, 0x213, 1) + "__result",
                        resultKind: "SEQUENCE" as const,
                        duration: {
                            id: spellChildId(SPELL_IDS.RAY_OF_FROST, 0x214, 1),
                            durationKind: DURATION_KIND.ROUND,
                            amount: 1
                        },
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.RAY_OF_FROST, 0x213, 1),
                                effectKind: EFFECT_KIND.APPLY_GRANT,
                                grants: {
                                    modifiers: [
                                        {
                                            id: spellChildId(SPELL_IDS.RAY_OF_FROST, 0x215, 1),
                                            grantKind: GRANT_KIND.MODIFIER_GRANT,
                                            valueDomainCode: VALUE_DOMAIN_CODE.SPEED,
                                            domain: { speedId: walkSpeedId },
                                            modifierKind: MODIFIER_KIND.PENALTY,
                                            scope: MODIFIER_SCOPE_KIND.GLOBAL,
                                            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                                            payload: {
                                                valueKind: 'FIXED',
                                                amount: 10
                                            },
                                            order: 1
                                        }
                                    ]
                                }
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

