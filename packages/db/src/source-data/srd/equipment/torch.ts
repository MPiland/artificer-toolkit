import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const torch: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(179),
    label: 'Torch',
    description: "A wooden stick tipped with oil-soaked cloth that burns for 1 hour, shedding bright light 20 feet.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    attributes: [S.EQUIPMENT_ATTRIBUTE.STACKABLE],
    abilities: [],
    capabilities: [
      {
        id: S.equipmentChildId(S.equipId(179), 0x210, 1),
        order: 1,
        invocation: {
          triggerCode: S.TRIGGER.ACTIVATED,
          activation: {
            code: S.ACTIVATION_CODE.ACTION,
            amount: 1
          },
          range: {
            id: S.equipmentChildId(S.equipId(179), 0x211, 1),
            rangeKind: S.RANGE_KIND.SELF
          },
          targeting: {
            selectionKind: S.TARGET_SELECTION_KIND.SELF,
            detail: 'Light or brandish the torch you are holding.'
          }
        },
        branches: [
          {
            id: S.equipmentChildId(S.equipId(179), 0x212, 1),
            branch: S.BRANCH.ON_USE,
            groupType: S.BRANCH_GROUP_TYPE.SINGLE,
            resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
            effectKind: S.EFFECT_KIND.RULE,
            label: 'Torch',
            description: 'A burning torch sheds bright light in a 20-foot radius and dim light for an additional 20 feet for up to 1 hour. It can also be used to ignite flammable materials.'
          }
        ]
      }
    ],
    cost: S.cp(1),
    weight: S.lbs(1),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
