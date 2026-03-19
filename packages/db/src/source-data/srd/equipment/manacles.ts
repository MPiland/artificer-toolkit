import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const manacles: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(153),
    label: 'Manacles',
    description: "Iron restraints for binding a creature's wrists; DC 20 to break or escape.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    abilities: [],
    capabilities: [
      {
        id: S.equipmentChildId(S.equipId(153), 0x210, 1),
        order: 1,
        invocation: {
          triggerCode: S.TRIGGER.ACTIVATED,
          activation: {
            code: S.ACTIVATION_CODE.ACTION,
            amount: 1
          },
          range: {
            id: S.equipmentChildId(S.equipId(153), 0x211, 1),
            rangeKind: S.RANGE_KIND.TOUCH
          },
          targeting: {
            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
            detail: 'Attempt to secure the manacles on one restrained, incapacitated, or otherwise subdued creature within reach.'
          }
        },
        branches: [
          {
            id: S.equipmentChildId(S.equipId(153), 0x212, 1),
            branch: S.BRANCH.ON_USE,
            groupType: S.BRANCH_GROUP_TYPE.SINGLE,
            resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
            effectKind: S.EFFECT_KIND.RULE,
            label: 'Manacles',
            description: 'A creature bound by the manacles can use its action to make a DC 20 Dexterity check to escape. Another creature can use its action to break them with a DC 20 Strength check.'
          }
        ]
      }
    ],
    cost: S.gp(2),
    weight: S.lbs(6),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
