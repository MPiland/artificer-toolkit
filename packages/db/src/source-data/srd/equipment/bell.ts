import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const bell: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(124),
    label: 'Bell',
    description: "A small metal bell that produces a clear ringing tone when struck.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    abilities: [],
    capabilities: [
      {
        id: S.equipmentChildId(S.equipId(124), 0x210, 1),
        order: 1,
        invocation: {
          triggerCode: S.TRIGGER.ACTIVATED,
          activation: {
            code: S.ACTIVATION_CODE.ACTION,
            amount: 1
          },
          range: {
            id: S.equipmentChildId(S.equipId(124), 0x211, 1),
            rangeKind: S.RANGE_KIND.SELF
          },
          targeting: {
            selectionKind: S.TARGET_SELECTION_KIND.SELF,
            detail: 'Ring the bell to make an audible signal.'
          }
        },
        branches: [
          {
            id: S.equipmentChildId(S.equipId(124), 0x212, 1),
            branch: S.BRANCH.ON_USE,
            groupType: S.BRANCH_GROUP_TYPE.SINGLE,
            resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
            effectKind: S.EFFECT_KIND.RULE,
            label: 'Bell',
            description: 'Ringing the bell creates a clear audible signal that can be heard by nearby creatures according to the environment and distance.'
          }
        ]
      }
    ],
    cost: S.gp(1),
    weight: S.lbs(0),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
