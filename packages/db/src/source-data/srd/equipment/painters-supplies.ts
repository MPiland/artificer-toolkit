import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const paintersSupplies: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(62),
  label: "Painter's Supplies",
  description: 'Brushes, pigments, and a palette for creating paintings on canvas or other surfaces.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  abilities: [],
  capabilities: [
    {
      id: S.equipmentChildId(S.equipId(62), 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: S.TRIGGER.ACTIVATED,
        activation: {
          code: S.ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: S.equipmentChildId(S.equipId(62), 0x211, 1),
          rangeKind: S.RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Use the supplies on one canvas, surface, or painted work area within reach.'
        }
      },
      branches: [
        {
          id: S.equipmentChildId(S.equipId(62), 0x212, 1),
          branch: S.BRANCH.ON_USE,
          groupType: S.BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: S.EFFECT_KIND.RULE,
          label: "Painter's Supplies",
          description: 'Painter’s supplies are used to create paintings, heraldic marks, disguises, or similar visual works according to the applicable check and downtime rules.'
        }
      ]
    }
  ],
  cost: S.gp(10),
  weight: S.lbs(5),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
