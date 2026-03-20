import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const crowbar: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(136),
    label: 'Crowbar',
    description: "A metal bar for prying open doors, crates, or other objects.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    abilities: [],
    capabilities: [
      {
        id: S.equipmentChildId(S.equipId(136), 0x210, 1),
        order: 1,
        invocation: {
          triggerCode: S.TRIGGER.ACTIVATED,
          activation: {
            code: S.ACTIVATION_CODE.ACTION,
            amount: 1
          },
          range: {
            id: S.equipmentChildId(S.equipId(136), 0x211, 1),
            rangeKind: S.RANGE_KIND.TOUCH
          },
          targeting: {
            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
            detail: 'Use the crowbar on one door, chest, crate, or similar object within reach.'
          }
        },
        branches: [
          {
            id: S.equipmentChildId(S.equipId(136), 0x212, 1),
            branch: S.BRANCH.ON_USE,
            groupType: S.BRANCH_GROUP_TYPE.SINGLE,
            resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
            effectKind: S.EFFECT_KIND.RULE,
            label: 'Crowbar',
            description: 'Using a crowbar grants advantage to Strength checks where the crowbar’s leverage can be applied.'
          }
        ]
      }
    ],
    cost: S.gp(2),
    weight: S.lbs(5),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
