import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const blockAndTackle: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(126),
    label: 'Block and Tackle',
    description: "A set of pulleys with a cable that allows lifting loads up to four times your normal capacity.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    abilities: [],
    capabilities: [
      {
        id: S.equipmentChildId(S.equipId(126), 0x210, 1),
        order: 1,
        invocation: {
          triggerCode: S.TRIGGER.ACTIVATED,
          activation: {
            code: S.ACTIVATION_CODE.ACTION,
            amount: 1
          },
          range: {
            id: S.equipmentChildId(S.equipId(126), 0x211, 1),
            rangeKind: S.RANGE_KIND.TOUCH
          },
          targeting: {
            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
            detail: 'Rig the pulleys against one anchor point and one load within reach.'
          }
        },
        branches: [
          {
            id: S.equipmentChildId(S.equipId(126), 0x212, 1),
            branch: S.BRANCH.ON_USE,
            groupType: S.BRANCH_GROUP_TYPE.SINGLE,
            resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
            effectKind: S.EFFECT_KIND.RULE,
            label: 'Block and Tackle',
            description: 'A properly rigged block and tackle lets you hoist up to four times the weight you can normally lift.'
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
