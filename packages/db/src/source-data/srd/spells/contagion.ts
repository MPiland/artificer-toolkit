import { ABILITY_CODE, ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CASTING_TIME_UNIT_CODE, EFFECT_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SPELL_ATTRIBUTE, SUBJECT, TARGET_SELECTION_KIND, TRIGGER, type SpellAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SPELL_IDS } from '../ids.js';
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js';
export const contagion: SpellAuthored = {
    kind: SUBJECT.SPELL,
    id: SPELL_IDS.CONTAGION,
    label: 'Contagion',
    description: 'Your touch inflicts disease. Make a melee spell attack against a creature within your reach. On a hit, you afflict the creature with a disease of your choice from any of the ones described below.',
    castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
    level: 5,
    classIds: [CLASS_IDS.CLERIC, CLASS_IDS.DRUID],
    magicSchoolId: schoolId('NECROMANCY'),
    effects: [
        {
            id: spellChildId(SPELL_IDS.CONTAGION, 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: TRIGGER.SPELL_ATTACK,
                activation: {
                    code: ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: spellChildId(SPELL_IDS.CONTAGION, 0x211, 1),
                    rangeKind: RANGE_KIND.TOUCH
                },
                targeting: {
                    selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET
                }
            },
            paths: [
                {
                    id: spellChildId(SPELL_IDS.CONTAGION, 0x212, 1),
                    order: 1,
                    pathCode: PATH_CODE.ON_HIT,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.CONTAGION, 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.CONTAGION, 0x212, 1),
                                effectKind: EFFECT_KIND.RULE
                            }
                        ]
                    }
                },
                {
                    id: spellChildId(SPELL_IDS.CONTAGION, 0x213, 1),
                    order: 2,
                    pathCode: PATH_CODE.ON_MISS,
                    groupType: PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: spellChildId(SPELL_IDS.CONTAGION, 0x213, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: spellChildId(SPELL_IDS.CONTAGION, 0x213, 1),
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

