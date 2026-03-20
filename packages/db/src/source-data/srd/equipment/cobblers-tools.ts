import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const cobblersTools: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(56),
  label: "Cobbler's Tools",
  description: 'Lasts, awls, and leather-working implements for making and repairing footwear.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  abilities: [],
  capabilities: [
    {
      id: S.equipmentChildId(S.equipId(56), 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: S.TRIGGER.ACTIVATED,
        activation: {
          code: S.ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: S.equipmentChildId(S.equipId(56), 0x211, 1),
          rangeKind: S.RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Use the tools on one pair of shoes, leather component, or footwear repair setup within reach.'
        }
      },
      branches: [
        {
          id: S.equipmentChildId(S.equipId(56), 0x212, 1),
          branch: S.BRANCH.ON_USE,
          groupType: S.BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: S.EFFECT_KIND.RULE,
          label: "Cobbler's Tools",
          description: 'Cobbler’s tools are used to create, repair, or maintain footwear and related leather goods according to the applicable check and downtime rules.'
        }
      ]
    }
  ],
  cost: S.gp(5),
  weight: S.lbs(5),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
