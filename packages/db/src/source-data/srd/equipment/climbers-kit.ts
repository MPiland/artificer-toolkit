import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const climbersKit: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(86),
    label: "Climber's Kit",
    description: "Pitons, boot tips, gloves, and a harness for ascending sheer surfaces.",
    category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
    properties: [],
    abilities: [],
    capabilities: [
      {
        id: S.equipmentChildId(S.equipId(86), 0x210, 1),
        order: 1,
        invocation: {
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
            selectionKind: S.TARGET_SELECTION_KIND.SELF,
            detail: 'Secure yourself with the climber’s kit while climbing.'
          }
        },
        branches: [
          {
            id: S.equipmentChildId(S.equipId(86), 0x212, 1),
            branch: S.BRANCH.ON_USE,
            groupType: S.BRANCH_GROUP_TYPE.SINGLE,
            resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
            effectKind: S.EFFECT_KIND.RULE,
            label: "Climber's Kit",
            description: 'When anchored as part of a climb, a climber’s kit lets you secure yourself so you cannot fall more than 25 feet from the point where you anchored the kit.'
          }
        ]
      }
    ],
    cost: S.gp(25),
    weight: S.lbs(12),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
