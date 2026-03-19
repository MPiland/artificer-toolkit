import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const calligraphersSupplies: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(53),
  label: 'Calligrapher\'s Supplies',
  description: 'Inks, pens, and specialized paper for producing fine handwriting and illuminated manuscripts.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  abilities: [],
  capabilities: [
    {
      id: S.equipmentChildId(S.equipId(53), 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: S.TRIGGER.ACTIVATED,
        activation: {
          code: S.ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: S.equipmentChildId(S.equipId(53), 0x211, 1),
          rangeKind: S.RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Use the supplies on one document, writing surface, or manuscript within reach.'
        }
      },
      branches: [
        {
          id: S.equipmentChildId(S.equipId(53), 0x212, 1),
          branch: S.BRANCH.ON_USE,
          groupType: S.BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: S.EFFECT_KIND.RULE,
          label: 'Calligrapher\'s Supplies',
          description: 'Calligrapher’s supplies are used to create ornate writing, illuminate manuscripts, and prepare special written works according to the applicable check and downtime rules.'
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
