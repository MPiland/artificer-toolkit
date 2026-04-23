import type { EquipmentAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const holyWaterFlask: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(141),
    label: 'Holy Water (flask)',
    description: "A flask of blessed water that deals radiant damage to undead and fiends.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    effects: [
        {
            id: S.equipmentChildId(S.equipId(141), 0x210, 1),
            order: 1,
            invocation: {
                triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
                activation: {
                    code: S.ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: S.equipmentChildId(S.equipId(141), 0x211, 1),
                    rangeKind: S.RANGE_KIND.SPECIAL
                },
                targeting: {
                    selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
                }
            },
            paths: [
                {
                    id: S.equipmentChildId(S.equipId(141), 0x212, 1),
                    order: 1,
                    pathCode: S.PATH_CODE.ON_HIT,
                    groupType: S.PATH_GROUP_TYPE.SINGLE,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: S.equipmentChildId(S.equipId(141), 0x212, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: S.equipmentChildId(S.equipId(141), 0x212, 1),
                                effectKind: S.EFFECT_KIND.DAMAGE,
                                damageTypeId: S.damageTypeId('RADIANT'),
                                valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                scalingKind: S.SCALING.NONE,
                                diceConfig: '2d6'
                            }
                        ]
                    }
                }
            ]
        }
    ],
    cost: S.gp(25),
    weight: S.lbs(1),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
};


