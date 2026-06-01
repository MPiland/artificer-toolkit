import { ACTIVATION_CODE, AUTHORING_MODE_KIND, AUTHORING_SELECTION_KIND, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, CLASS_CATEGORY, EFFECT_KIND, RANGE_KIND, SCALING, TARGET_SELECTION_KIND, TRIGGER, type ClassAuthored } from '@artificer-toolkit/shared';
import { CLASS_IDS, SUBCLASS_IDS } from '../ids.js';
import { SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js';
function classRowId(classIndex: number, group: number, entry: number): string {
    const xx = classIndex.toString(16).padStart(2, '0');
    const gg = group.toString(16).padStart(2, '0');
    const nn = entry.toString(16).padStart(2, '0');
    return `00000000-0000-0000-c0${xx}-${gg}${nn}00000000`;
}
const M = 6;
export const wayOfTheOpenHand: ClassAuthored = {
    id: SUBCLASS_IDS.OPEN_HAND,
    label: 'Way of the Open Hand',
    category: CLASS_CATEGORY.SUBCLASS,
    parentClassId: CLASS_IDS.MONK,
    description: 'Monks of the Way of the Open Hand are the ultimate masters of martial arts combat, whether armed or unarmed.',
    userId: SRD_USER_ID,
    systemId: SRD_SYSTEM_ID,
    features: [
        {
            id: classRowId(M, 11, 1),
            label: 'Open Hand Technique',
            description: 'Starting when you choose this tradition at 3rd level, you can manipulate your enemy\'s ki when you harness your own. Whenever you hit a creature with one of the attacks granted by your Flurry of Blows, you can impose one of the following effects on that target.',
            availableAtLevel: 3,
            order: 0
        },
        {
            id: classRowId(M, 11, 2),
            label: 'Wholeness of Body',
            description: 'At 6th level, you gain the ability to heal yourself. As an action, you can regain hit points equal to three times your monk level. You must finish a long rest before you can use this feature again.',
            availableAtLevel: 6,
            order: 1,
            attributes: ['LIMITED_USE'],
            charges: {
                id: classRowId(M, 11, 20),
                limitKind: 'FIXED_AMOUNT',
                scalingKind: SCALING.NONE,
                resetKind: 'LONG_REST',
                amount: 1
            },
            effects: [
                {
                    id: classRowId(M, 11, 21),
                    order: 0,
                    invocation: {
                        kind: 'ACTION' as const,
                        triggerCode: TRIGGER.ACTIVATED,
                        activation: {
                            code: ACTIVATION_CODE.ACTION,
                            amount: 1
                        },
                        range: {
                            id: classRowId(M, 11, 22),
                            rangeKind: RANGE_KIND.SELF
                        },
                        targeting: {
                            selectionKind: TARGET_SELECTION_KIND.SELF
                        }
                    },
                    paths: [
                        {
                            id: classRowId(M, 11, 23),
                            order: 1,
                            pathCode: PATH_CODE.ON_USE,
                            groupType: PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: "FIXED" as const,
                            resultBlock: {
                                id: classRowId(M, 11, 23) + "__result",
                                resultKind: "SINGLE" as const,
                                outcomes: [
                                    {
                                        id: classRowId(M, 11, 23),
                                        effectKind: EFFECT_KIND.HEAL,
                                        valueKind: 'FIXED',
                                        amount: 0,
                                        scalingKind: SCALING.NONE,
                                        bonuses: [
                                            {
                                                id: classRowId(M, 11, 24),
                                                bonusKind: 'CLASS_LEVEL',
                                                classId: CLASS_IDS.MONK,
                                                multiplier: 3,
                                                order: 0
                                            }
                                        ]
                                    }
                                ]
                            }
                        }
                    ]
                }
            ]
        },
        {
            id: classRowId(M, 11, 3),
            label: 'Tranquility',
            description: 'Beginning at 11th level, you can enter a special meditation that surrounds you with an aura of peace. At the end of a long rest, you gain the effect of a Sanctuary spell that lasts until the start of your next long rest.',
            availableAtLevel: 11,
            order: 2
        },
        {
            id: classRowId(M, 11, 4),
            label: 'Quivering Palm',
            description: 'At 17th level, you gain the ability to set up lethal vibrations in someone\'s body. When you hit a creature with an unarmed strike, you can spend 3 ki points to start these imperceptible vibrations.',
            availableAtLevel: 17,
            order: 3
        }
    ]
};

