import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const magnifyingGlass: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(152),
    label: 'Magnifying Glass',
    description: "A lens that focuses light, useful for examining fine detail or starting fires in sunlight.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    abilities: [],
    capabilities: [
      {
        id: S.equipmentChildId(S.equipId(152), 0x210, 1),
        order: 1,
        invocation: {
          triggerCode: S.TRIGGER.ACTIVATED,
          activation: {
            code: S.ACTIVATION_CODE.ACTION,
            amount: 1
          },
          range: {
            id: S.equipmentChildId(S.equipId(152), 0x211, 1),
            rangeKind: S.RANGE_KIND.TOUCH
          },
          targeting: {
            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
            detail: 'Use the lens to inspect one nearby object or small area in good light.'
          }
        },
        branches: [
          {
            id: S.equipmentChildId(S.equipId(152), 0x212, 1),
            branch: S.BRANCH.ON_USE,
            groupType: S.BRANCH_GROUP_TYPE.SINGLE,
            resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
            effectKind: S.EFFECT_KIND.RULE,
            label: 'Magnifying Glass',
            description: 'A magnifying glass grants advantage on checks made to appraise or inspect small, highly detailed objects. It can also be used to start fire in sunlight, which takes about 5 minutes.'
          }
        ]
      }
    ],
    cost: S.gp(100),
    weight: S.lbs(0),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
