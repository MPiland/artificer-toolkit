import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const woodcarversTools: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(67),
  label: "Woodcarver's Tools",
  description: 'Chisels, gouges, and knives for carving decorative or functional objects from wood.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  abilities: [],
  capabilities: [
    {
      id: S.equipmentChildId(S.equipId(67), 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: S.TRIGGER.ACTIVATED,
        activation: {
          code: S.ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: S.equipmentChildId(S.equipId(67), 0x211, 1),
          rangeKind: S.RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Use the tools on one woodcarving workspace, carving project, or wooden object within reach.'
        }
      },
      branches: [
        {
          id: S.equipmentChildId(S.equipId(67), 0x212, 1),
          branch: S.BRANCH.ON_USE,
          groupType: S.BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: S.EFFECT_KIND.RULE,
          label: "Woodcarver's Tools",
          description: 'Woodcarver’s tools are used to carve, modify, and repair wooden objects according to the applicable check and downtime rules.'
        }
      ]
    }
  ],
  cost: S.gp(1),
  weight: S.lbs(5),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
