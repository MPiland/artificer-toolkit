import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const ballBearingsBagOf1000: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(122),
    label: 'Ball Bearings (bag of 1000)',
    description: "A bag of 1,000 small metal balls that can be scattered to trip creatures moving across them.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    abilities: [],
    capabilities: [
      {
        id: S.equipmentChildId(S.equipId(122), 0x210, 1),
        order: 1,
        invocation: {
          triggerCode: S.TRIGGER.ACTIVATED,
          activation: {
            code: S.ACTIVATION_CODE.ACTION,
            amount: 1
          },
          range: {
            id: S.equipmentChildId(S.equipId(122), 0x211, 1),
            rangeKind: S.RANGE_KIND.TOUCH
          },
          targeting: {
            selectionKind: S.TARGET_SELECTION_KIND.AREA_CONTENTS,
            detail: 'Scatter the bearings across a 10-foot square on level ground within reach.'
          }
        },
        branches: [
          {
            id: S.equipmentChildId(S.equipId(122), 0x212, 1),
            branch: S.BRANCH.ON_USE,
            groupType: S.BRANCH_GROUP_TYPE.SINGLE,
            resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
            effectKind: S.EFFECT_KIND.RULE,
            label: 'Ball Bearings',
            description: 'A creature moving across the covered area must succeed on a DC 10 Dexterity saving throw or fall prone. Moving through the area at half speed avoids the saving throw.'
          }
        ]
      }
    ],
    cost: S.gp(1),
    weight: S.lbs(2),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
