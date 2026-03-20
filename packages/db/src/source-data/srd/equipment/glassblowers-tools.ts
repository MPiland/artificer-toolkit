import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const glassblowersTools: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(58),
  label: "Glassblower's Tools",
  description: 'A blowpipe and shaping tools for working molten glass into vessels and objects.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  abilities: [],
  capabilities: [
    {
      id: S.equipmentChildId(S.equipId(58), 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: S.TRIGGER.ACTIVATED,
        activation: {
          code: S.ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: S.equipmentChildId(S.equipId(58), 0x211, 1),
          rangeKind: S.RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Use the tools on one glassworking setup, molten glass preparation, or glass object within reach.'
        }
      },
      branches: [
        {
          id: S.equipmentChildId(S.equipId(58), 0x212, 1),
          branch: S.BRANCH.ON_USE,
          groupType: S.BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: S.EFFECT_KIND.RULE,
          label: "Glassblower's Tools",
          description: 'Glassblower’s tools are used to shape, repair, and inspect glass objects according to the applicable check and downtime rules.'
        }
      ]
    }
  ],
  cost: S.gp(30),
  weight: S.lbs(5),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
