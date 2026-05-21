import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, EFFECT_KIND, RANGE_KIND, SUBJECT, TARGET_SELECTION_KIND, TARGET_DISPOSITION_KIND, TRIGGER, type SpellAuthored, SPELL_COMPONENT } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const heroesFeast: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.HEROES_FEAST,
    label: "Heroes' Feast",
    description: "You bring forth a great feast, including magnificent food and drink. The feast takes 1 hour to consume and disappears at the end of that time, and the beneficial effects don't set in until this hour is over. Up to twelve creatures can partake of the feast.",
    castingTime: { unit: CASTING_TIME_UNIT_CODE.MINUTE, amount: 10 },
    level: 6,
    classIds: [CLASS_IDS.CLERIC, CLASS_IDS.DRUID],
    components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
    materialDescription: 'a gem---encrusted bowl worth at least 1,000 gp, which the spell consumes',
    magicSchoolId: schoolId('CONJURATION'),
    effects: [
        {
            id: spellChildId(SPELL_IDS.HEROES_FEAST, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.HEROES_FEAST, 0x211, 1),
                    rangeKind: RANGE_KIND.SPECIAL
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
                    dispositionKind: TARGET_DISPOSITION_KIND.ANY,
                    maxTargets: 12
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.HEROES_FEAST, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.HEROES_FEAST, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.HEROES_FEAST, 0x212, 1),
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

