import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const pottersTools: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(63),
  label: "Potter's Tools",
  description: 'A wheel, shaping tools, and glazing materials for crafting ceramic vessels.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  abilities: [],
  capabilities: [
    {
      id: S.equipmentChildId(S.equipId(63), 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: S.TRIGGER.ACTIVATED,
        activation: {
          code: S.ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: S.equipmentChildId(S.equipId(63), 0x211, 1),
          rangeKind: S.RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Use the tools on one pottery wheel, clay preparation, or ceramic piece within reach.'
        }
      },
      branches: [
        {
          id: S.equipmentChildId(S.equipId(63), 0x212, 1),
          branch: S.BRANCH.ON_USE,
          groupType: S.BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: S.EFFECT_KIND.RULE,
          label: "Potter's Tools",
          description: 'Potter’s tools are used to shape, fire, repair, and appraise ceramic goods according to the applicable check and downtime rules.'
        }
      ]
    }
  ],
  cost: S.gp(10),
  weight: S.lbs(3),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
