import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const cooksUtensils: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(57),
  label: "Cook's Utensils",
  description: 'Pots, pans, knives, and seasoning equipment for preparing meals over a campfire or in a kitchen.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  abilities: [],
  capabilities: [
    {
      id: S.equipmentChildId(S.equipId(57), 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: S.TRIGGER.ACTIVATED,
        activation: {
          code: S.ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: S.equipmentChildId(S.equipId(57), 0x211, 1),
          rangeKind: S.RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Use the utensils on one cooking fire, kitchen workspace, or meal preparation within reach.'
        }
      },
      branches: [
        {
          id: S.equipmentChildId(S.equipId(57), 0x212, 1),
          branch: S.BRANCH.ON_USE,
          groupType: S.BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: S.EFFECT_KIND.RULE,
          label: "Cook's Utensils",
          description: 'Cook’s utensils are used to prepare meals, preserve food, and evaluate ingredients according to the applicable check and downtime rules.'
        }
      ]
    }
  ],
  cost: S.gp(1),
  weight: S.lbs(8),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
