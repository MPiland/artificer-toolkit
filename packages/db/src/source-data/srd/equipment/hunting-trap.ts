import type { EquipmentAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const huntingTrap: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(143),
    label: 'Hunting Trap',
    description: "A serrated steel trap with a spring mechanism that snaps shut on a creature's leg.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    effects: [
        {
            id: S.equipmentChildId(S.equipId(143), 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: S.TRIGGER.ACTIVATED,
                activation: {
                    code: S.ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: S.equipmentChildId(S.equipId(143), 0x211, 1),
                    rangeKind: S.RANGE_KIND.TOUCH
                },
                targeting: {
                    selectionKind: S.TARGET_SELECTION_KIND.AREA_CONTENTS
                }
            },
            paths: [
                {
                    id: S.equipmentChildId(S.equipId(143), 0x212, 1),
                    order: 1,
                    pathCode: S.PATH_CODE.ON_USE,
                    groupType: S.PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: S.equipmentChildId(S.equipId(143), 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: S.equipmentChildId(S.equipId(143), 0x212, 1),
                                effectKind: S.EFFECT_KIND.RULE
                            }
                        ]
                    }
                }
            ]
        }
    ],
    cost: S.gp(5),
    weight: S.lbs(25),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
};


