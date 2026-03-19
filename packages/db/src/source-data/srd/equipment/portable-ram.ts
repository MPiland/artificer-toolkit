import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const portableRam: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(163),
    label: 'Portable Ram',
    description: "A heavy log fitted with handles for bashing open doors, granting advantage on Strength checks to break them.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    abilities: [],
    capabilities: [
      {
        id: S.equipmentChildId(S.equipId(163), 0x210, 1),
        order: 1,
        invocation: {
          triggerCode: S.TRIGGER.ACTIVATED,
          activation: {
            code: S.ACTIVATION_CODE.ACTION,
            amount: 1
          },
          range: {
            id: S.equipmentChildId(S.equipId(163), 0x211, 1),
            rangeKind: S.RANGE_KIND.TOUCH
          },
          targeting: {
            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
            detail: 'Use the ram against one door, gate, or similar barrier within reach.'
          }
        },
        branches: [
          {
            id: S.equipmentChildId(S.equipId(163), 0x212, 1),
            branch: S.BRANCH.ON_USE,
            groupType: S.BRANCH_GROUP_TYPE.SINGLE,
            resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
            effectKind: S.EFFECT_KIND.RULE,
            label: 'Portable Ram',
            description: 'When you use the ram to break open a door, you gain a +4 bonus to the Strength check. A second creature helping you grants advantage on the check.'
          }
        ]
      }
    ],
    cost: S.gp(4),
    weight: S.lbs(35),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
