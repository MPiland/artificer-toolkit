import type { EquipmentAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const caltropsBagOf20: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(128),
    label: 'Caltrops (bag of 20)',
    description: "As an action, you can spread a bag of caltrops to cover a square area that is 5 feet on a side. Any creature that enters the area must succeed on a DC 15 Dexterity saving throw or stop moving this turn and take 1 piercing damage. Taking this damage reduces the creature's walking speed by 10 feet until the creature regains at least 1 hit point. A creature moving through the area at half speed doesn't need to make the save.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    effects: [
        {
            id: S.equipmentChildId(S.equipId(128), 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: S.TRIGGER.ACTIVATED,
                activation: {
                    code: S.ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: S.equipmentChildId(S.equipId(128), 0x211, 1),
                    rangeKind: S.RANGE_KIND.TOUCH
                },
                targeting: {
                    selectionKind: S.TARGET_SELECTION_KIND.AREA_CONTENTS,
                    dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
                }
            },
            paths: [
                {
                    id: S.equipmentChildId(S.equipId(128), 0x212, 1),
                    order: 1,
                    pathCode: S.PATH_CODE.ON_USE,
                    groupType: S.PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: S.equipmentChildId(S.equipId(128), 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: S.equipmentChildId(S.equipId(128), 0x212, 1),
                                effectKind: S.EFFECT_KIND.RULE
                            }
                        ]
                    }
                }
            ]
        }
    ],
    cost: S.gp(1),
    weight: S.lbs(2),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
};


