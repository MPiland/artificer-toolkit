import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, EFFECT_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SPELL_ATTRIBUTE, SUBJECT, TARGET_SELECTION_KIND, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const locateAnimalsOrPlants: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.LOCATE_ANIMALS_OR_PLANTS,
    label: 'Locate Animals or Plants',
    description: 'Describe or name a specific kind of beast or plant. You learn the direction and distance to the closest creature or plant of that kind within 5 miles, if any are present.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 2,
    classIds: [CLASS_IDS.BARD, CLASS_IDS.DRUID, CLASS_IDS.RANGER],
    magicSchoolId: schoolId('DIVINATION'),
    attributes: [SPELL_ATTRIBUTE.RITUAL],
    effects: [
        {
            id: spellChildId(SPELL_IDS.LOCATE_ANIMALS_OR_PLANTS, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.LOCATE_ANIMALS_OR_PLANTS, 0x211, 1),
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 5,
                    unit: MEASUREMENT_UNIT_CODE.MILES
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.LOCATE_ANIMALS_OR_PLANTS, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.LOCATE_ANIMALS_OR_PLANTS, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.LOCATE_ANIMALS_OR_PLANTS, 0x212, 1),
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

