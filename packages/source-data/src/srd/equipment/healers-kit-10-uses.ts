import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const healersKit10Uses: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(140),
  label: "Healer's Kit (10 uses)",
  description:
    'This kit is a leather pouch containing bandages, salves, and splints. The kit has ten uses. As an action, you can expend one use of the kit to stabilize a creature that has 0 hit points, without needing to make a Wisdom (Medicine) check.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  attributes: [S.EQUIPMENT_ATTRIBUTE.LIMITED_USE],
  charges: {
    id: S.equipmentChildId(S.equipId(140), 0x205, 1),
    limitKind: 'FIXED_AMOUNT' as const,
    scalingKind: S.SCALING.NONE,
    amount: 10,
    resetKind: 'MANUAL' as const
  },
  effects: [
    {
      id: S.equipmentChildId(S.equipId(140), 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: S.TRIGGER.ACTIVATED,
        resourceUse: {
          chargeId: S.equipmentChildId(S.equipId(140), 0x205, 1),
          cost: 1
        },
        activation: {
          code: S.ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: S.equipmentChildId(S.equipId(140), 0x211, 1),
          rangeKind: S.RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: S.equipmentChildId(S.equipId(140), 0x212, 1),
          order: 1,
          pathCode: S.PATH_CODE.ON_USE,
          groupType: S.PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: S.equipmentChildId(S.equipId(140), 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: S.equipmentChildId(S.equipId(140), 0x212, 1),
                effectKind: S.EFFECT_KIND.STABILIZE,
                requiresZeroHitPoints: true
              }
            ]
          }
        }
      ]
    }
  ],
  cost: S.gp(5),
  weight: S.lbs(3),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
