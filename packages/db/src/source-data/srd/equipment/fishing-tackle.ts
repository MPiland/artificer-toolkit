import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const fishingTackle: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(137),
    label: 'Fishing Tackle',
    description: "A rod, line, hooks, floats, and bait for catching fish.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    abilities: [],
    capabilities: [
      {
        id: S.equipmentChildId(S.equipId(137), 0x210, 1),
        order: 1,
        invocation: {
          triggerCode: S.TRIGGER.ACTIVATED,
          activation: {
            code: S.ACTIVATION_CODE.ACTION,
            amount: 1
          },
          range: {
            id: S.equipmentChildId(S.equipId(137), 0x211, 1),
            rangeKind: S.RANGE_KIND.SPECIAL
          },
          targeting: {
            selectionKind: S.TARGET_SELECTION_KIND.AREA_CONTENTS,
            detail: 'Use the tackle at a suitable body of water to attempt to catch fish.'
          }
        },
        branches: [
          {
            id: S.equipmentChildId(S.equipId(137), 0x212, 1),
            branch: S.BRANCH.ON_USE,
            groupType: S.BRANCH_GROUP_TYPE.SINGLE,
            resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
            effectKind: S.EFFECT_KIND.RULE,
            label: 'Fishing Tackle',
            description: 'Fishing tackle is used to catch fish or other small aquatic creatures according to the environment, time available, and any applicable check rules.'
          }
        ]
      }
    ],
    cost: S.gp(1),
    weight: S.lbs(4),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
