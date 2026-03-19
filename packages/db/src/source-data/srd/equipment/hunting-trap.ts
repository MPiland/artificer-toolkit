import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const huntingTrap: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(143),
    label: 'Hunting Trap',
    description: "A serrated steel trap with a spring mechanism that snaps shut on a creature's leg.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    abilities: [],
    capabilities: [
      {
        id: S.equipmentChildId(S.equipId(143), 0x210, 1),
        order: 1,
        invocation: {
          triggerCode: S.TRIGGER.ACTIVATED,
          activation: {
            code: S.ACTIVATION_CODE.ACTION,
            amount: 1
          },
          range: {
            id: S.equipmentChildId(S.equipId(143), 0x211, 1),
            rangeKind: S.RANGE_KIND.TOUCH
          },
          targeting: {
            selectionKind: S.TARGET_SELECTION_KIND.AREA_CONTENTS,
            detail: 'Set the trap in an adjacent space where a creature can trigger it.'
          }
        },
        branches: [
          {
            id: S.equipmentChildId(S.equipId(143), 0x212, 1),
            branch: S.BRANCH.ON_USE,
            groupType: S.BRANCH_GROUP_TYPE.SINGLE,
            resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
            effectKind: S.EFFECT_KIND.RULE,
            label: 'Hunting Trap',
            description: 'A creature stepping on the hidden trap must succeed on a DC 13 Dexterity saving throw or take 1d4 piercing damage and stop moving. Until the trap is broken free or escaped with a DC 13 Strength check, the creature’s movement is limited by the chain.'
          }
        ]
      }
    ],
    cost: S.gp(5),
    weight: S.lbs(25),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
