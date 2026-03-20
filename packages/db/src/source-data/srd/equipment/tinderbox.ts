import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const tinderbox: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(178),
  label: 'Tinderbox',
  description: 'A small container holding flint, fire steel, and tinder for starting fires.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  abilities: [],
  capabilities: [
    {
      id: S.equipmentChildId(S.equipId(178), 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: S.TRIGGER.ACTIVATED,
        activation: {
          code: S.ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: S.equipmentChildId(S.equipId(178), 0x211, 1),
          rangeKind: S.RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Use the tinderbox to light one torch or another source of abundant, exposed fuel within reach.'
        }
      },
      branches: [
        {
          id: S.equipmentChildId(S.equipId(178), 0x212, 1),
          branch: S.BRANCH.ON_USE,
          groupType: S.BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: S.EFFECT_KIND.RULE,
          label: 'Light Fire',
          description: 'Lighting a torch or any other source of abundant, exposed fuel takes 1 action. Lighting any other fire with the tinderbox takes 1 minute according to the SRD item text.'
        }
      ]
    }
  ],
  cost: S.sp(5),
  weight: S.lbs(1),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
