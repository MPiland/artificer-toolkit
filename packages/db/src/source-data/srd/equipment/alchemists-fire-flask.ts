import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const alchemistsFireFlask: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(120),
    label: "Alchemist's Fire (flask)",
    description: "A sticky, adhesive fluid that ignites on contact with air and is difficult to extinguish.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    abilities: [],
    capabilities: [
      {
        id: S.equipmentChildId(S.equipId(120), 0x210, 1),
        order: 1,
        invocation: {
          triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
          activation: {
            code: S.ACTIVATION_CODE.ACTION,
            amount: 1
          },
          range: {
            id: S.equipmentChildId(S.equipId(120), 0x211, 1),
            rangeKind: S.RANGE_KIND.SPECIAL
          },
          targeting: {
            selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
            detail: 'Throw the flask at one creature within the alchemist’s fire special range.'
          }
        },
        branches: [
          {
            id: S.equipmentChildId(S.equipId(120), 0x212, 1),
            branch: S.BRANCH.ON_HIT,
            groupType: S.BRANCH_GROUP_TYPE.SEQUENTIAL,
            resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
            effectKind: S.EFFECT_KIND.DAMAGE,
            damageTypeId: S.damageTypeId('FIRE'),
            valueKind: S.DAMAGE_VALUE_KIND.DICE,
            scalingKind: S.SCALING.NONE,
            diceConfig: '1d4'
          },
          {
            id: S.equipmentChildId(S.equipId(120), 0x213, 1),
            branch: S.BRANCH.ON_HIT,
            groupType: S.BRANCH_GROUP_TYPE.SEQUENTIAL,
            resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
            effectKind: S.EFFECT_KIND.RULE,
            label: "Alchemist's Fire",
            description: 'On a hit, the target takes 1d4 fire damage at the start of each of its turns until a creature uses its action to make a DC 10 Dexterity check to extinguish the flames.'
          },
          {
            id: S.equipmentChildId(S.equipId(120), 0x214, 1),
            branch: S.BRANCH.ON_MISS,
            groupType: S.BRANCH_GROUP_TYPE.SINGLE,
            resolutionKind: S.BRANCH_RESOLUTION_KIND.DIRECT,
            effectKind: S.EFFECT_KIND.RULE,
            label: 'Miss',
            description: "On a miss, the flask's fire does not cling to the target."
          }
        ]
      }
    ],
    cost: S.gp(50),
    weight: S.lbs(1),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
