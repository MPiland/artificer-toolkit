import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const tinkersTools: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(65),
  label: "Tinker's Tools",
  description: 'Small tools for repairing and assembling mechanical devices, including screwdrivers and pliers.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  abilities: [],
  capabilities: [
    {
      id: S.equipmentChildId(S.equipId(65), 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: S.TRIGGER.ACTIVATED,
        activation: {
          code: S.ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: S.equipmentChildId(S.equipId(65), 0x211, 1),
          rangeKind: S.RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Use the tools on one device, mechanism, or repair workspace within reach.'
        }
      },
      branches: [
        {
          id: S.equipmentChildId(S.equipId(65), 0x212, 1),
          branch: S.BRANCH.ON_USE,
          groupType: S.BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: S.EFFECT_KIND.RULE,
          label: "Tinker's Tools",
          description: 'Tinker’s tools are used to repair devices, assemble mechanisms, and improvise small mechanical fixes according to the applicable check and downtime rules.'
        }
      ]
    }
  ],
  cost: S.gp(50),
  weight: S.lbs(10),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
