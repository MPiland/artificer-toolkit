import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const cartographersTools: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(55),
  label: "Cartographer's Tools",
  description: 'Instruments for drawing accurate maps, including compasses, rulers, and specialized inks.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  abilities: [],
  capabilities: [
    {
      id: S.equipmentChildId(S.equipId(55), 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: S.TRIGGER.ACTIVATED,
        activation: {
          code: S.ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: S.equipmentChildId(S.equipId(55), 0x211, 1),
          rangeKind: S.RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Use the tools on one map, chart, or survey surface within reach.'
        }
      },
      branches: [
        {
          id: S.equipmentChildId(S.equipId(55), 0x212, 1),
          branch: S.BRANCH.ON_USE,
          groupType: S.BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: S.EFFECT_KIND.RULE,
          label: "Cartographer's Tools",
          description: 'Cartographer’s tools are used to draw maps, chart terrain, and make or interpret geographic records according to the applicable check and downtime rules.'
        }
      ]
    }
  ],
  cost: S.gp(15),
  weight: S.lbs(6),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
