import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const forgeryKit: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(81),
  label: 'Forgery Kit',
  description: 'Inks, papers, and seal-making tools for duplicating documents and signatures.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  abilities: [],
  capabilities: [
    {
      id: S.equipmentChildId(S.equipId(81), 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: S.TRIGGER.ACTIVATED,
        activation: {
          code: S.ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: S.equipmentChildId(S.equipId(81), 0x211, 1),
          rangeKind: S.RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Use the kit on one document, seal, or writing workspace within reach.'
        }
      },
      branches: [
        {
          id: S.equipmentChildId(S.equipId(81), 0x212, 1),
          branch: S.BRANCH.ON_USE,
          groupType: S.BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: S.EFFECT_KIND.RULE,
          label: 'Forgery Kit',
          description: 'A forgery kit is used to duplicate documents, imitate handwriting, and create false seals or credentials according to the applicable check rules.'
        }
      ]
    }
  ],
  cost: S.gp(15),
  weight: S.lbs(5),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
