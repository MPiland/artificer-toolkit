import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const climbersKit: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(86),
  label: "Climber's Kit",
  description:
    "A climber's kit includes special pitons, boot tips, gloves, and a harness. You can use the climber's kit as an action to anchor yourself; when you do, you can't fall more than 25 feet from the point where you anchored yourself, and you can't climb more than 25 feet away from that point without undoing the anchor.",
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
            resultKind: 'SEQUENCE' as const,
            outcomes: [
              {
                id: S.equipmentChildId(S.equipId(86), 0x212, 1),
                effectKind: S.EFFECT_KIND.MANIFEST,
                manifestKind: 'OBJECT' as const,
                attachmentKind: 'SOURCE' as const,
                label: 'Climbing anchor'
              },
              {
                id: S.equipmentChildId(S.equipId(86), 0x213, 1),
                effectKind: S.EFFECT_KIND.MOVEMENT_RULE,
                ruleKind: 'MAX_FALL_DISTANCE_FROM_ANCHOR' as const,
                limitDistance: { amount: 25, unit: S.MEASUREMENT_UNIT_CODE.FEET }
              },
              {
                id: S.equipmentChildId(S.equipId(86), 0x214, 1),
                effectKind: S.EFFECT_KIND.MOVEMENT_RULE,
                ruleKind: 'MAX_CLIMB_DISTANCE_FROM_ANCHOR' as const,
                limitDistance: { amount: 25, unit: S.MEASUREMENT_UNIT_CODE.FEET }
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
