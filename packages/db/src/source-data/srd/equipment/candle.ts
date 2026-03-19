import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const candle: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(129),
    label: 'Candle',
    description: "A tallow or wax candle that sheds dim light in a 5-foot radius for 1 hour.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    attributes: [S.EQUIPMENT_ATTRIBUTE.STACKABLE],
    abilities: [],
    capabilities: [
      {
        id: S.equipmentChildId(S.equipId(129), 0x210, 1),
        order: 1,
        invocation: {
          triggerCode: S.TRIGGER.ACTIVATED,
          activation: {
            code: S.ACTIVATION_CODE.ACTION,
            amount: 1
          },
          range: {
            id: S.equipmentChildId(S.equipId(129), 0x211, 1),
            rangeKind: S.RANGE_KIND.SELF
          },
          targeting: {
            selectionKind: S.TARGET_SELECTION_KIND.SELF,
            detail: 'Light or place the candle you are using.'
          }
        },
        branches: [
          {
            id: S.equipmentChildId(S.equipId(129), 0x212, 1),
            branch: S.BRANCH.ON_USE,
            groupType: S.BRANCH_GROUP_TYPE.SINGLE,
            resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
            effectKind: S.EFFECT_KIND.RULE,
            label: 'Candle',
            description: 'A burning candle sheds dim light in a 5-foot radius for up to 1 hour and can be used to ignite other flammable materials.'
          }
        ]
      }
    ],
    cost: S.cp(1),
    weight: S.lbs(0),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
