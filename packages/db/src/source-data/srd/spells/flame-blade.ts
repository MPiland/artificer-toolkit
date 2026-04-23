import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, EFFECT_KIND, RANGE_KIND, SPELL_ATTRIBUTE, SUBJECT, TARGET_SELECTION_KIND, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const flameBlade: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.FLAME_BLADE,
    label: 'Flame Blade',
    description: 'You evoke a fiery blade in your free hand. It lasts for the duration, sheds light, and can be used to make melee spell attacks that deal fire damage.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 2,
    classIds: [CLASS_IDS.DRUID],
    magicSchoolId: schoolId('EVOCATION'),
    attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
    effects: [
        {
            id: spellChildId(SPELL_IDS.FLAME_BLADE, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.FLAME_BLADE, 0x211, 1),
                    rangeKind: RANGE_KIND.SELF
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.SELF
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.FLAME_BLADE, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.FLAME_BLADE, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.FLAME_BLADE, 0x212, 1),
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

