import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const smithsTools: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(64),
  label: "Smith's Tools",
  description: 'Hammers, tongs, and files for working metal at the forge.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  abilities: [],
  capabilities: [
    {
      id: S.equipmentChildId(S.equipId(64), 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: S.TRIGGER.ACTIVATED,
        activation: {
          code: S.ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: S.equipmentChildId(S.equipId(64), 0x211, 1),
          rangeKind: S.RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Use the tools on one metal object, weapon, armor piece, or forge setup within reach.'
        }
      },
      branches: [
        {
          id: S.equipmentChildId(S.equipId(64), 0x212, 1),
          branch: S.BRANCH.ON_USE,
          groupType: S.BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: S.EFFECT_KIND.RULE,
          label: "Smith's Tools",
          description: 'Smith’s tools are used to craft, repair, or modify metal objects and perform related forge work according to the applicable check and downtime rules.'
        }
      ]
    }
  ],
  cost: S.gp(20),
  weight: S.lbs(8),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
