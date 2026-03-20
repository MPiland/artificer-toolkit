import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const alchemistsSupplies: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(51),
  label: "Alchemist's Supplies",
  description: 'Tools for practicing the craft of alchemy, including vials, a mortar and pestle, and common reagents.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  abilities: [],
  capabilities: [
    {
      id: S.equipmentChildId(S.equipId(51), 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: S.TRIGGER.ACTIVATED,
        activation: {
          code: S.ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: S.equipmentChildId(S.equipId(51), 0x211, 1),
          rangeKind: S.RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Use the supplies on one alchemical workspace, reagent set, or in-progress preparation within reach.'
        }
      },
      branches: [
        {
          id: S.equipmentChildId(S.equipId(51), 0x212, 1),
          branch: S.BRANCH.ON_USE,
          groupType: S.BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: S.EFFECT_KIND.RULE,
          label: "Alchemist's Supplies",
          description: 'Alchemist’s supplies are used to identify substances, craft alchemical compounds, and perform similar alchemical tasks according to the applicable check and downtime rules.'
        }
      ]
    }
  ],
  cost: S.gp(50),
  weight: S.lbs(8),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
