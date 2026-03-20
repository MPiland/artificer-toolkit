import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const jewelersTools: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(59),
  label: "Jeweler's Tools",
  description: 'Fine pliers, magnifying lenses, and polishing cloths for cutting, setting, and appraising gems.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  abilities: [],
  capabilities: [
    {
      id: S.equipmentChildId(S.equipId(59), 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: S.TRIGGER.ACTIVATED,
        activation: {
          code: S.ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: S.equipmentChildId(S.equipId(59), 0x211, 1),
          rangeKind: S.RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Use the tools on one gem, piece of jewelry, or gem-setting workspace within reach.'
        }
      },
      branches: [
        {
          id: S.equipmentChildId(S.equipId(59), 0x212, 1),
          branch: S.BRANCH.ON_USE,
          groupType: S.BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: S.EFFECT_KIND.RULE,
          label: "Jeweler's Tools",
          description: 'Jeweler’s tools are used to cut, set, appraise, or repair gems and jewelry according to the applicable check and downtime rules.'
        }
      ]
    }
  ],
  cost: S.gp(25),
  weight: S.lbs(2),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
