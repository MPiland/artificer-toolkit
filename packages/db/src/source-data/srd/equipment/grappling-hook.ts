import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const grapplingHook: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(138),
    label: 'Grappling Hook',
    description: "A metal hook with multiple prongs for anchoring a rope to ledges or railings.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    abilities: [],
    capabilities: [
      {
        id: S.equipmentChildId(S.equipId(138), 0x210, 1),
        order: 1,
        invocation: {
          triggerCode: S.TRIGGER.ACTIVATED,
          activation: {
            code: S.ACTIVATION_CODE.ACTION,
            amount: 1
          },
          range: {
            id: S.equipmentChildId(S.equipId(138), 0x211, 1),
            rangeKind: S.RANGE_KIND.TOUCH
          },
          targeting: {
            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
            detail: 'Attach the hook to a rope and throw or place it onto one ledge, rail, or anchoring point.'
          }
        },
        branches: [
          {
            id: S.equipmentChildId(S.equipId(138), 0x212, 1),
            branch: S.BRANCH.ON_USE,
            groupType: S.BRANCH_GROUP_TYPE.SINGLE,
            resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
            effectKind: S.EFFECT_KIND.RULE,
            label: 'Grappling Hook',
            description: 'A grappling hook is used to secure a rope to a distant anchor point for climbing, swinging, or retrieval according to the applicable check rules.'
          }
        ]
      }
    ],
    cost: S.gp(2),
    weight: S.lbs(4),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
