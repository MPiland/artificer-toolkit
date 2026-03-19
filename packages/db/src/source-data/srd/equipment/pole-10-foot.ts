import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const pole10Foot: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(162),
    label: 'Pole (10-foot)',
    description: "A sturdy wooden pole 10 feet long for probing, pushing, or bridging narrow gaps.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    abilities: [],
    capabilities: [
      {
        id: S.equipmentChildId(S.equipId(162), 0x210, 1),
        order: 1,
        invocation: {
          triggerCode: S.TRIGGER.ACTIVATED,
          activation: {
            code: S.ACTIVATION_CODE.ACTION,
            amount: 1
          },
          range: {
            id: S.equipmentChildId(S.equipId(162), 0x211, 1),
            rangeKind: S.RANGE_KIND.SPECIAL
          },
          targeting: {
            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
            detail: 'Use the pole to probe, push, or support one nearby hazard, object, or gap.'
          }
        },
        branches: [
          {
            id: S.equipmentChildId(S.equipId(162), 0x212, 1),
            branch: S.BRANCH.ON_USE,
            groupType: S.BRANCH_GROUP_TYPE.SINGLE,
            resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
            effectKind: S.EFFECT_KIND.RULE,
            label: 'Pole',
            description: 'A 10-foot pole is used to probe dangerous ground, trigger hazards from a safer distance, push objects, or bridge small gaps according to the situation.'
          }
        ]
      }
    ],
    cost: S.cp(5),
    weight: S.lbs(7),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
