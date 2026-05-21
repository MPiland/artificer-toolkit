import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, DURATION_KIND, EFFECT_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SPELL_ATTRIBUTE, SUBJECT, TARGET_SELECTION_KIND, TARGET_DISPOSITION_KIND, TRIGGER, SPELL_COMPONENT, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { conditionTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const animalFriendship: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.ANIMAL_FRIENDSHIP,
    label: 'Animal Friendship',
    description: "This spell lets you convince a beast that you mean it no harm. Choose a beast that you can see within range. It must see and hear you. If the beast's Intelligence is 4 or higher, the spell fails.",
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 1,
    classIds: [CLASS_IDS.BARD, CLASS_IDS.DRUID, CLASS_IDS.RANGER],
    components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
    materialDescription: "a morsel of food",
    magicSchoolId: schoolId('ENCHANTMENT'),
    attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
    effects: [
        {
            id: spellChildId(SPELL_IDS.ANIMAL_FRIENDSHIP, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.ANIMAL_FRIENDSHIP, 0x211, 1),
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 30,
                    unit: MEASUREMENT_UNIT_CODE.FEET
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
                    dispositionKind: TARGET_DISPOSITION_KIND.ANY
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.ANIMAL_FRIENDSHIP, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.ANIMAL_FRIENDSHIP, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        duration: {
                            id: spellChildId(SPELL_IDS.ANIMAL_FRIENDSHIP, 0x213, 1),
                            durationKind: DURATION_KIND.DAY,
                            amount: 1
                        },
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.ANIMAL_FRIENDSHIP, 0x212, 1),
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

