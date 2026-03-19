import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const herbalismKit: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(82),
    label: 'Herbalism Kit',
    description: "Pouches, clippers, and reference materials for gathering and preparing medicinal plants.",
    category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
    properties: [],
    abilities: [],
    capabilities: [
      {
        id: S.equipmentChildId(S.equipId(82), 0x210, 1),
        order: 1,
        invocation: {
          triggerCode: S.TRIGGER.ACTIVATED,
          activation: {
            code: S.ACTIVATION_CODE.ACTION,
            amount: 1
          },
          range: {
            id: S.equipmentChildId(S.equipId(82), 0x211, 1),
            rangeKind: S.RANGE_KIND.TOUCH
          },
          targeting: {
            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
            detail: 'Use the kit on gathered herbs, medicinal plants, or a preparation workspace within reach.'
          }
        },
        branches: [
          {
            id: S.equipmentChildId(S.equipId(82), 0x212, 1),
            branch: S.BRANCH.ON_USE,
            groupType: S.BRANCH_GROUP_TYPE.SINGLE,
            resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
            effectKind: S.EFFECT_KIND.RULE,
            label: 'Herbalism Kit',
            description: 'An herbalism kit is used to identify plants, gather useful herbs, and prepare remedies such as antitoxin or basic healing preparations according to the applicable check and downtime rules.'
          }
        ]
      }
    ],
    cost: S.gp(5),
    weight: S.lbs(3),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
