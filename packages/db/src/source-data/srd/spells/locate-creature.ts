import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, EFFECT_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SUBJECT, TRIGGER, SPELL_COMPONENT, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const locateCreature: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.LOCATE_CREATURE,
    label: 'Locate Creature',
    description: "Describe or name a creature that is familiar to you. You sense the direction to the creature's location, as long as that creature is within 1,000 feet of you. If the creature is moving, you know the direction of its movement.",
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 4,
    classIds: [CLASS_IDS.BARD, CLASS_IDS.CLERIC, CLASS_IDS.DRUID, CLASS_IDS.PALADIN, CLASS_IDS.RANGER, CLASS_IDS.WIZARD],
    components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
    materialDescription: "a bit of fur from a bloodhound",
    magicSchoolId: schoolId('DIVINATION'),
    effects: [
        {
            id: spellChildId(SPELL_IDS.LOCATE_CREATURE, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.ACTIVATED,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.LOCATE_CREATURE, 0x211, 1),
                    rangeKind: RANGE_KIND.DISTANCE,
                    amount: 1000,
                    unit: MEASUREMENT_UNIT_CODE.FEET
                },
                targeting: {
                    selectionKind: 'SELF'
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.LOCATE_CREATURE, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_USE,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.LOCATE_CREATURE, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        duration: {
                            id: spellChildId(SPELL_IDS.LOCATE_CREATURE, 0x213, 1),
                            durationKind: 'HOUR',
                            amount: 1
                        },
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.LOCATE_CREATURE, 0x212, 1),
                                effectKind: EFFECT_KIND.RULE
                            }
                        ]
                    }
                }
            ]
        }
    ],
    userId: SRD_USER_ID,
    systemId: SRD_SYSTEM_ID,
};

