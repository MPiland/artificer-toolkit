import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const leatherworkersTools: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(60),
  label: "Leatherworker's Tools",
  description: 'Knives, punches, and dyes for cutting and stitching leather into goods.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  abilities: [],
  capabilities: [
    {
      id: S.equipmentChildId(S.equipId(60), 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: S.TRIGGER.ACTIVATED,
        activation: {
          code: S.ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: S.equipmentChildId(S.equipId(60), 0x211, 1),
          rangeKind: S.RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Use the tools on one leather object, hide, or leatherworking setup within reach.'
        }
      },
      branches: [
        {
          id: S.equipmentChildId(S.equipId(60), 0x212, 1),
          branch: S.BRANCH.ON_USE,
          groupType: S.BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: S.EFFECT_KIND.RULE,
          label: "Leatherworker's Tools",
          description: 'Leatherworker’s tools are used to craft, repair, or modify leather goods and related gear according to the applicable check and downtime rules.'
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
