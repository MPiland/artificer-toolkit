import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const brewersSupplies: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(52),
  label: "Brewer's Supplies",
  description: 'Equipment for brewing ale, wine, and other beverages, including a large pot and various fermentation tools.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  abilities: [],
  capabilities: [
    {
      id: S.equipmentChildId(S.equipId(52), 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: S.TRIGGER.ACTIVATED,
        activation: {
          code: S.ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: S.equipmentChildId(S.equipId(52), 0x211, 1),
          rangeKind: S.RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Use the supplies on one brewing setup, fermentation vessel, or beverage preparation within reach.'
        }
      },
      branches: [
        {
          id: S.equipmentChildId(S.equipId(52), 0x212, 1),
          branch: S.BRANCH.ON_USE,
          groupType: S.BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: S.EFFECT_KIND.RULE,
          label: "Brewer's Supplies",
          description: 'Brewer’s supplies are used to brew, purify, and evaluate beverages according to the applicable check and downtime rules.'
        }
      ]
    }
  ],
  cost: S.gp(20),
  weight: S.lbs(9),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
