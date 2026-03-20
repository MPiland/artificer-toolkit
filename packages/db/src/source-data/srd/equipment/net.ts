import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const net: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(37),
    label: 'Net',
    description: 'A weighted net thrown to restrain foes.',
    category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
    properties: [S.EQUIPMENT_PROPERTY_CODE.MARTIAL, S.EQUIPMENT_PROPERTY_CODE.RANGED, S.EQUIPMENT_PROPERTY_CODE.THROWN, S.EQUIPMENT_PROPERTY_CODE.SPECIAL],
    abilities: [],
    capabilities: [
      {
        id: S.equipmentChildId(S.equipId(37), 0x210, 1),
        order: 1,
        invocation: {
          triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
          activation: {
            code: S.ACTIVATION_CODE.ACTION,
            amount: 1
          },
          range: {
            id: S.equipmentChildId(S.equipId(37), 0x211, 1),
            rangeKind: S.RANGE_KIND.SPECIAL
          },
          targeting: {
            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
            detail: 'Throw the net at one Large or smaller creature within the net’s special range.'
          }
        },
        branches: [
          {
            id: S.equipmentChildId(S.equipId(37), 0x212, 1),
            branch: S.BRANCH.ON_HIT,
            groupType: S.BRANCH_GROUP_TYPE.SEQUENTIAL,
            resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
            effectKind: S.EFFECT_KIND.CONDITION,
            conditionId: S.conditionTypeId('RESTRAINED')
          },
          {
            id: S.equipmentChildId(S.equipId(37), 0x213, 1),
            branch: S.BRANCH.ON_HIT,
            groupType: S.BRANCH_GROUP_TYPE.SEQUENTIAL,
            resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
            effectKind: S.EFFECT_KIND.RULE,
            label: 'Net Special',
            description: 'A Large or smaller creature hit by the net is restrained until it is freed. A creature can use its action to make a DC 10 Strength check, freeing itself or another creature within its reach on a success. Dealing 5 slashing damage to the net also frees the creature without harming it.'
          },
          {
            id: S.equipmentChildId(S.equipId(37), 0x214, 1),
            branch: S.BRANCH.ON_MISS,
            groupType: S.BRANCH_GROUP_TYPE.SINGLE,
            resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
            effectKind: S.EFFECT_KIND.RULE,
            label: 'Miss',
            description: 'On a miss, the net does not restrain the target.'
          }
        ]
      }
    ],
    cost: S.gp(1),
    weight: S.lbs(3),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
