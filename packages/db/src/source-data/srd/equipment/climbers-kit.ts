import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const climbersKit: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(86),
  label: "Climber's Kit",
  description: 'Pitons, boot tips, gloves, and a harness for ascending sheer surfaces.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  effects: [
    {
      id: S.equipmentChildId(S.equipId(86), 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: S.TRIGGER.ACTIVATED,
        activation: {
          code: S.ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: S.equipmentChildId(S.equipId(86), 0x211, 1),
          rangeKind: S.RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.SELF
        }
      },
      paths: [
        {
          id: S.equipmentChildId(S.equipId(86), 0x212, 1),
          order: 1,
          pathCode: S.PATH_CODE.ON_USE,
          groupType: S.PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: S.equipmentChildId(S.equipId(86), 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: S.equipmentChildId(S.equipId(86), 0x212, 1),
                effectKind: S.EFFECT_KIND.MANUAL_ADJUDICATION
              }
            ]
          }
        }
      ]
    }
  ],
  cost: S.gp(25),
  weight: S.lbs(12),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
