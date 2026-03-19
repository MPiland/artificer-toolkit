import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const bullseyeLantern: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(149),
    label: 'Bullseye Lantern',
    description: "A lantern with a focused lens that casts bright light in a 60-foot cone.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    abilities: [],
    capabilities: [
      {
        id: S.equipmentChildId(S.equipId(149), 0x210, 1),
        order: 1,
        invocation: {
          triggerCode: S.TRIGGER.ACTIVATED,
          activation: {
            code: S.ACTIVATION_CODE.ACTION,
            amount: 1
          },
          range: {
            id: S.equipmentChildId(S.equipId(149), 0x211, 1),
            rangeKind: S.RANGE_KIND.SELF
          },
          targeting: {
            selectionKind: S.TARGET_SELECTION_KIND.SELF,
            detail: 'Light or direct the bullseye lantern you are carrying.'
          }
        },
        branches: [
          {
            id: S.equipmentChildId(S.equipId(149), 0x212, 1),
            branch: S.BRANCH.ON_USE,
            groupType: S.BRANCH_GROUP_TYPE.SINGLE,
            resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
            effectKind: S.EFFECT_KIND.RULE,
            label: 'Bullseye Lantern',
            description: 'A lit bullseye lantern sheds bright light in a 60-foot cone and dim light for an additional 60 feet. One flask of oil fuels the lantern for 6 hours.'
          }
        ]
      }
    ],
    cost: S.gp(10),
    weight: S.lbs(2),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
