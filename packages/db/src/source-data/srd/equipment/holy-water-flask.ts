import type { EquipmentAuthored } from '@artificer-toolkit/shared';
import * as S from './shared.js';
export const holyWaterFlask: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(141),
    label: 'Holy Water (flask)',
    description: "As an action, you can splash the contents of this flask onto a creature within 5 feet of you or throw it up to 20 feet, shattering it on impact. In either case, make a ranged attack against a target creature, treating the holy water as an improvised weapon. If the target is a fiend or undead, it takes 2d6 radiant damage. A cleric or paladin may create holy water by performing a special ritual. The ritual takes 1 hour to perform, uses 25 gp worth of powdered silver, and requires the caster to expend a 1st-level spell slot.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [S.EQUIPMENT_PROPERTY_CODE.FLASK],
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
                    selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
                    dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
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


