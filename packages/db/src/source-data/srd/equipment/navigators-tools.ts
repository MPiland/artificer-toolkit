import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const navigatorsTools: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(83),
  label: "Navigator's Tools",
  description: 'A sextant, compass, charts, and measuring instruments for charting courses at sea.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  abilities: [],
  capabilities: [
    {
      id: S.equipmentChildId(S.equipId(83), 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: S.TRIGGER.ACTIVATED,
        activation: {
          code: S.ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: S.equipmentChildId(S.equipId(83), 0x211, 1),
          rangeKind: S.RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Use the tools on one route, chart, map, or voyage plan within reach.'
        }
      },
      branches: [
        {
          id: S.equipmentChildId(S.equipId(83), 0x212, 1),
          branch: S.BRANCH.ON_USE,
          groupType: S.BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: S.EFFECT_KIND.RULE,
          label: "Navigator's Tools",
          description: 'Navigator’s tools are used to chart courses, determine position, and guide sea travel according to the applicable check and downtime rules.'
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
