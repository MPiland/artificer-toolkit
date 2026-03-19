import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const potionOfHealing: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(164),
    label: 'Potion of Healing',
    description: "A vial of red liquid that restores 2d4+2 hit points when consumed.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    abilities: [],
    capabilities: [
      {
        id: S.equipmentChildId(S.equipId(164), 0x210, 1),
        order: 1,
        invocation: {
          triggerCode: S.TRIGGER.ACTIVATED,
          activation: {
            code: S.ACTIVATION_CODE.ACTION,
            amount: 1
          },
          range: {
            id: S.equipmentChildId(S.equipId(164), 0x211, 1),
            rangeKind: S.RANGE_KIND.TOUCH
          },
          targeting: {
            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
            detail: 'Drink the potion yourself or administer it to one creature within reach.'
          }
        },
        branches: [
          {
            id: S.equipmentChildId(S.equipId(164), 0x212, 1),
            branch: S.BRANCH.ON_USE,
            groupType: S.BRANCH_GROUP_TYPE.SINGLE,
            resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
            effectKind: S.EFFECT_KIND.HEAL,
            valueKind: 'DICE',
            scalingKind: S.SCALING.NONE,
            diceConfig: '2d4+2'
          }
        ]
      }
    ],
    cost: S.gp(50),
    weight: S.lbs(0.5),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
