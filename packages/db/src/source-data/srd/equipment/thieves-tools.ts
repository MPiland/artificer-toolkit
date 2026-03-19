import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const thievesTools: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(85),
    label: "Thieves' Tools",
    description: "A small file, a set of lock picks, a small mirror, a pair of scissors, and pliers.",
    category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
    properties: [],
    abilities: [],
    capabilities: [
      {
        id: S.equipmentChildId(S.equipId(85), 0x210, 1),
        order: 1,
        invocation: {
          triggerCode: S.TRIGGER.ACTIVATED,
          activation: {
            code: S.ACTIVATION_CODE.ACTION,
            amount: 1
          },
          range: {
            id: S.equipmentChildId(S.equipId(85), 0x211, 1),
            rangeKind: S.RANGE_KIND.TOUCH
          },
          targeting: {
            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
            detail: 'Use the tools on one lock or trap mechanism within reach.'
          }
        },
        branches: [
          {
            id: S.equipmentChildId(S.equipId(85), 0x212, 1),
            branch: S.BRANCH.ON_USE,
            groupType: S.BRANCH_GROUP_TYPE.SINGLE,
            resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
            effectKind: S.EFFECT_KIND.RULE,
            label: "Thieves' Tools",
            description: 'These tools are used to pick locks, disarm traps, and perform similar delicate sabotage or infiltration tasks according to the applicable check rules.'
          }
        ]
      }
    ],
    cost: S.gp(25),
    weight: S.lbs(1),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
