import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const healersKit10Uses: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(140),
    label: "Healer's Kit (10 uses)",
    description: "Bandages, salves, and splints used to stabilize a dying creature without a medicine check.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    abilities: [],
    attributes: [S.EQUIPMENT_ATTRIBUTE.LIMITED_USE],
    capabilities: [
      {
        id: S.equipmentChildId(S.equipId(140), 0x210, 1),
        order: 1,
        invocation: {
          triggerCode: S.TRIGGER.ACTIVATED,
          activation: {
            code: S.ACTIVATION_CODE.ACTION,
            amount: 1
          },
          range: {
            id: S.equipmentChildId(S.equipId(140), 0x211, 1),
            rangeKind: S.RANGE_KIND.TOUCH
          },
          targeting: {
            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET
          }
        },
        branches: [
          {
            id: S.equipmentChildId(S.equipId(140), 0x212, 1),
            branch: S.BRANCH.ON_USE,
            groupType: S.BRANCH_GROUP_TYPE.SINGLE,
            resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
            effectKind: S.EFFECT_KIND.RULE,
          }
        ]
      }
    ],
    cost: S.gp(5),
    weight: S.lbs(3),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
