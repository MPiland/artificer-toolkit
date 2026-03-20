import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const weaversTools: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(66),
  label: "Weaver's Tools",
  description: 'A loom shuttle, needles, and thread for weaving cloth and tapestries.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  abilities: [],
  capabilities: [
    {
      id: S.equipmentChildId(S.equipId(66), 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: S.TRIGGER.ACTIVATED,
        activation: {
          code: S.ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: S.equipmentChildId(S.equipId(66), 0x211, 1),
          rangeKind: S.RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Use the tools on one loom, textile workspace, or cloth project within reach.'
        }
      },
      branches: [
        {
          id: S.equipmentChildId(S.equipId(66), 0x212, 1),
          branch: S.BRANCH.ON_USE,
          groupType: S.BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: S.EFFECT_KIND.RULE,
          label: "Weaver's Tools",
          description: 'Weaver’s tools are used to weave, repair, and assess cloth or textiles according to the applicable check and downtime rules.'
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
