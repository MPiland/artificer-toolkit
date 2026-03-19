import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const hammer: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(139),
    label: 'Hammer',
    description: "A steel-headed hammer suitable for driving pitons or nails.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    abilities: [],
    capabilities: [
      {
        id: S.equipmentChildId(S.equipId(139), 0x210, 1),
        order: 1,
        invocation: {
          triggerCode: S.TRIGGER.ACTIVATED,
          activation: {
            code: S.ACTIVATION_CODE.ACTION,
            amount: 1
          },
          range: {
            id: S.equipmentChildId(S.equipId(139), 0x211, 1),
            rangeKind: S.RANGE_KIND.TOUCH
          },
          targeting: {
            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
            detail: 'Use the hammer on one piton, spike, nail, or similar object within reach.'
          }
        },
        branches: [
          {
            id: S.equipmentChildId(S.equipId(139), 0x212, 1),
            branch: S.BRANCH.ON_USE,
            groupType: S.BRANCH_GROUP_TYPE.SINGLE,
            resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
            effectKind: S.EFFECT_KIND.RULE,
            label: 'Hammer',
            description: 'A hammer is used to drive pitons, spikes, and nails, or to apply force to small construction or climbing tasks according to the situation.'
          }
        ]
      }
    ],
    cost: S.gp(1),
    weight: S.lbs(3),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
