import { ACTIVATION_CODE, ABILITY_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, EFFECT_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SCALING, TARGET_SELECTION_KIND, SUBJECT, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const dissonantWhispers: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.DISSONANT_WHISPERS,
    label: 'Dissonant Whispers',
    description: 'You whisper a discordant melody that only one creature of your choice within range can hear. The target must succeed on a Wisdom saving throw or take 3d6 psychic damage and move away from you using its reaction.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 1,
    classIds: [CLASS_IDS.WARLOCK],
    magicSchoolId: schoolId('ENCHANTMENT'),
    effects: [
        {
            id: spellChildId(SPELL_IDS.DISSONANT_WHISPERS, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.SAVING_THROW,
                savingThrow: {
                    id: spellChildId(SPELL_IDS.DISSONANT_WHISPERS, 0x214, 1),
                    savingThrowKind: 'SOURCE_SAVE_DC',
                    ability: ABILITY_CODE.WISDOM
                },
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.DISSONANT_WHISPERS, 0x211, 1),
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
                    id: spellChildId(SPELL_IDS.DISSONANT_WHISPERS, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_SAVE_FAIL,
                    groupType: PATH_GROUP_TYPE.SEQUENTIAL,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.DISSONANT_WHISPERS, 0x212, 1) + "__result",
                        resultKind: "SEQUENCE" as const,
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.DISSONANT_WHISPERS, 0x212, 1),
                                effectKind: EFFECT_KIND.DAMAGE,
                                damageTypeId: damageTypeId('PSYCHIC'),
                                valueKind: 'DICE',
                                scalingKind: SCALING.NONE,
                                diceConfig: '3d6'
                            }
                        ]
                    }
                },
                {
                    id: spellChildId(SPELL_IDS.DISSONANT_WHISPERS, 0x213, 1),
                    order: 2,
                    pathCode: PATH_CODE.ON_SAVE_FAIL,
                    groupType: PATH_GROUP_TYPE.SEQUENTIAL,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.DISSONANT_WHISPERS, 0x213, 1) + "__result",
                        resultKind: "SEQUENCE" as const,
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.DISSONANT_WHISPERS, 0x213, 1),
                                effectKind: 'FORCED_MOVEMENT',
                                direction: 'AWAY_FROM_SOURCE',
                                distanceMode: 'UP_TO_SPEED',
                                actionEconomy: 'REACTION'
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

