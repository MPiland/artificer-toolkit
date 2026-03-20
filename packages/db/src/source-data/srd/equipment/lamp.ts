import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const lamp: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(148),
    label: 'Lamp',
    description: "An oil lamp that casts bright light in a 15-foot radius and dim light for an additional 30 feet.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    abilities: [],
    capabilities: [
      {
        id: S.equipmentChildId(S.equipId(148), 0x210, 1),
        order: 1,
        invocation: {
          triggerCode: S.TRIGGER.ACTIVATED,
          activation: {
            code: S.ACTIVATION_CODE.ACTION,
            amount: 1
          },
          range: {
            id: S.equipmentChildId(S.equipId(148), 0x211, 1),
            rangeKind: S.RANGE_KIND.SELF
          },
          targeting: {
            selectionKind: S.TARGET_SELECTION_KIND.SELF,
            detail: 'Light or extinguish the lamp you are carrying.'
          }
        },
        branches: [
          {
            id: S.equipmentChildId(S.equipId(148), 0x212, 1),
            branch: S.BRANCH.ON_USE,
            groupType: S.BRANCH_GROUP_TYPE.SINGLE,
            resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
            effectKind: S.EFFECT_KIND.RULE,
            label: 'Lamp',
            description: 'A lit lamp sheds bright light in a 15-foot radius and dim light for an additional 30 feet. One flask of oil fuels the lamp for 6 hours.'
          }
        ]
      }
    ],
    cost: S.sp(5),
    weight: S.lbs(1),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
