import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, EFFECT_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SUBJECT, TARGET_SELECTION_KIND, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const dispelMagic: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.DISPEL_MAGIC,
    label: 'Dispel Magic',
    description: 'Choose one creature, object, or magical effect within range. Any spell of 3rd level or lower on the target ends. Stronger spells require a spellcasting ability check to dispel.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 3,
    classIds: [
        CLASS_IDS.BARD,
        CLASS_IDS.CLERIC,
        CLASS_IDS.DRUID,
        CLASS_IDS.PALADIN,
        CLASS_IDS.SORCERER,
        CLASS_IDS.WARLOCK,
        CLASS_IDS.WIZARD
    ],
    magicSchoolId: schoolId('ABJURATION'),
    effects: [
        {
            id: spellChildId(SPELL_IDS.DISPEL_MAGIC, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.DISPEL_MAGIC, 0x211, 1),
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 120,
                    unit: MEASUREMENT_UNIT_CODE.FEET
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.DISPEL_MAGIC, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.DISPEL_MAGIC, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.DISPEL_MAGIC, 0x212, 1),
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

