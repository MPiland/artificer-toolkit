import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const ironSpikes10: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(146),
    label: 'Iron Spikes (10)',
    description: "A bundle of 10 iron spikes useful for securing ropes, propping doors, or climbing.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    abilities: [],
    capabilities: [
      {
        id: S.equipmentChildId(S.equipId(146), 0x210, 1),
        order: 1,
        invocation: {
          triggerCode: S.TRIGGER.ACTIVATED,
          activation: {
            code: S.ACTIVATION_CODE.ACTION,
            amount: 1
          },
          range: {
            id: S.equipmentChildId(S.equipId(146), 0x211, 1),
            rangeKind: S.RANGE_KIND.TOUCH
          },
          targeting: {
            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
            detail: 'Drive or wedge a spike into one surface, crack, or fixture within reach.'
          }
        },
        branches: [
          {
            id: S.equipmentChildId(S.equipId(146), 0x212, 1),
            branch: S.BRANCH.ON_USE,
            groupType: S.BRANCH_GROUP_TYPE.SINGLE,
            resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
            effectKind: S.EFFECT_KIND.RULE,
            label: 'Iron Spikes',
            description: 'Iron spikes are used to anchor ropes, secure doors, brace objects, or support climbing and camp tasks according to the situation.'
          }
        ]
      }
    ],
    cost: S.gp(1),
    weight: S.lbs(5),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
