import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, EFFECT_KIND, RANGE_KIND, SUBJECT, TRIGGER, SPELL_COMPONENT, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const legendLore: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.LEGEND_LORE,
    label: 'Legend Lore',
    description: 'Name or describe a person, place, or object. The spell brings to your mind a brief summary of the significant lore about the thing you named.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.MINUTE, amount: 10 },
    level: 5,
    classIds: [CLASS_IDS.BARD, CLASS_IDS.CLERIC, CLASS_IDS.WIZARD],
    components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
    materialDescription: "incense worth at least 250 gp, which the spell consumes, and four ivory strips worth at least 50 gp each",
    magicSchoolId: schoolId('DIVINATION'),
    effects: [
        {
            id: spellChildId(SPELL_IDS.LEGEND_LORE, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.LEGEND_LORE, 0x211, 1),
                    rangeKind: RANGE_KIND.SELF
                },
                targeting: {
                    selectionKind: 'SELF'
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.LEGEND_LORE, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.LEGEND_LORE, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.LEGEND_LORE, 0x212, 1),
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

