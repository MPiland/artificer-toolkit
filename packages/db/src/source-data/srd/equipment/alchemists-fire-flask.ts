import type { EquipmentAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const alchemistsFireFlask: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(120),
    label: "Alchemist's Fire (flask)",
    description: "This sticky, adhesive fluid ignites when exposed to air. As an action, you can throw this flask up to 20 feet, shattering it on impact. Make a ranged attack against a creature or object, treating the alchemist's fire as an improvised weapon. On a hit, the target takes 1d4 fire damage at the start of each of its turns. A creature can end this damage by using its action to make a DC 10 Dexterity check to extinguish the flames.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [S.EQUIPMENT_PROPERTY_CODE.FLASK],
    effects: [
        {
            id: S.equipmentChildId(S.equipId(120), 0x210, 1),
            order: 1,
            invocation: {
                kind: 'ACTION' as const,
                triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
                activation: {
                    code: S.ACTIVATION_CODE.ACTION,
                    amount: 1
                },
                range: {
                    id: S.equipmentChildId(S.equipId(120), 0x211, 1),
                    rangeKind: S.RANGE_KIND.SPECIAL
                },
                targeting: {
                    selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
                    dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
                }
            },
            paths: [
                {
                    id: S.equipmentChildId(S.equipId(120), 0x212, 1),
                    order: 1,
                    pathCode: S.PATH_CODE.ON_HIT,
                    groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                    originKind: 'SOURCE' as const,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: S.equipmentChildId(S.equipId(120), 0x212, 1) + "__result",
                        resultKind: "SEQUENCE" as const,
                        outcomes: [
                            {
                                id: S.equipmentChildId(S.equipId(120), 0x212, 1),
                                effectKind: S.EFFECT_KIND.DAMAGE,
                                damageTypeId: S.damageTypeId('FIRE'),
                                valueKind: S.DAMAGE_VALUE_KIND.DICE,
                                scalingKind: S.SCALING.NONE,
                                diceConfig: '1d4'
                            }
                        ]
                    }
                },
                {
                    id: S.equipmentChildId(S.equipId(120), 0x213, 1),
                    order: 2,
                    pathCode: S.PATH_CODE.ON_HIT,
                    groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
                    originKind: 'SOURCE' as const,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: S.equipmentChildId(S.equipId(120), 0x213, 1) + "__result",
                        resultKind: "SEQUENCE" as const,
                        outcomes: [
                            {
                                id: S.equipmentChildId(S.equipId(120), 0x213, 1),
                                effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION
                            }
                        ]
                    }
                },
                {
                    id: S.equipmentChildId(S.equipId(120), 0x214, 1),
                    order: 3,
                    pathCode: S.PATH_CODE.ON_MISS,
                    groupType: S.PATH_GROUP_TYPE.SINGLE,
                    originKind: 'SOURCE' as const,
                    selectionKind: "FIXED" as const,
                    resultBlock: {
                        id: S.equipmentChildId(S.equipId(120), 0x214, 1) + "__result",
                        resultKind: "SINGLE" as const,
                        outcomes: [
                            {
                                id: S.equipmentChildId(S.equipId(120), 0x214, 1),
                                effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION
                            }
                        ]
                    }
                }
            ]
        }
    ],
    cost: S.gp(50),
    weight: S.lbs(1),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
};


