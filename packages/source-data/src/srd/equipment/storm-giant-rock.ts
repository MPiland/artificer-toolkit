import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

const equipmentId = S.equipId(384)

export const stormGiantRock: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: equipmentId,
  label: 'Storm Giant Rock',
  description: null,
  category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
  properties: [S.EQUIPMENT_PROPERTY_CODE.RANGED],
  modifiers: S.rangedWeaponAbilityModifiers(equipmentId, S.ABILITY_CODE.STRENGTH),
  effects: [
    {
      id: S.equipmentChildId(equipmentId, 0x210, 1),
      order: 1,
      grip: S.EQUIPMENT_GRIP.ONE_HANDED,
      invocation: {
        kind: 'ACTION',
        triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
        range: {
          id: S.equipmentChildId(equipmentId, 0x211, 1),
          rangeKind: S.RANGE_KIND.DISTANCE,
          amount: 60,
          longAmount: 240,
          unit: S.MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: S.equipmentChildId(equipmentId, 0x212, 1),
          order: 1,
          pathCode: S.PATH_CODE.ON_HIT,
          groupType: S.PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE',
          selectionKind: 'FIXED',
          resultBlock: {
            id: `${S.equipmentChildId(equipmentId, 0x212, 1)}__result`,
            resultKind: 'SINGLE',
            outcomes: [
              {
                id: S.equipmentChildId(equipmentId, 0x212, 1),
                effectKind: S.EFFECT_KIND.DAMAGE,
                damageTypeId: S.damageTypeId('BLUDGEONING'),
                valueKind: S.DAMAGE_VALUE_KIND.DICE,
                scalingKind: S.SCALING.NONE,
                diceConfig: '4d12'
              }
            ]
          }
        }
      ]
    }
  ],
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
