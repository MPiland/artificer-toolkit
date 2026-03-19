import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const poisonersKit: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(84),
    label: "Poisoner's Kit",
    description: "Vials, a mortar and pestle, and reference materials for crafting and applying poisons.",
    category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
    properties: [],
    abilities: [],
    capabilities: [
      {
        id: S.equipmentChildId(S.equipId(84), 0x210, 1),
        order: 1,
        invocation: {
          triggerCode: S.TRIGGER.ACTIVATED,
          activation: {
            code: S.ACTIVATION_CODE.ACTION,
            amount: 1
          },
          range: {
            id: S.equipmentChildId(S.equipId(84), 0x211, 1),
            rangeKind: S.RANGE_KIND.TOUCH
          },
          targeting: {
            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
            detail: 'Use the kit on one dose of poison, weapon, or poison-making workspace within reach.'
          }
        },
        branches: [
          {
            id: S.equipmentChildId(S.equipId(84), 0x212, 1),
            branch: S.BRANCH.ON_USE,
            groupType: S.BRANCH_GROUP_TYPE.SINGLE,
            resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
            effectKind: S.EFFECT_KIND.RULE,
            label: "Poisoner's Kit",
            description: 'A poisoner’s kit is used to craft poisons, identify poisonous substances, or safely apply poison according to the applicable check and downtime rules.'
          }
        ]
      }
    ],
    cost: S.gp(50),
    weight: S.lbs(2),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
