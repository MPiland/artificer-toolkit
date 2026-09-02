import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const spikedBoneClub: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(380),
  label: 'Spiked Bone Club',
  description: null,
  category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MELEE],
  modifiers: S.meleeWeaponAbilityModifiers(S.equipId(380)),
  effects: [
    {
      id: S.equipmentChildId(S.equipId(380), 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: S.TRIGGER.MELEE_WEAPON_ATTACK,
        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
        range: {
          id: S.equipmentChildId(S.equipId(380), 0x211, 1),
          rangeKind: S.RANGE_KIND.DISTANCE,
          amount: 5,
          unit: S.MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: S.equipmentChildId(S.equipId(380), 0x212, 1),
          order: 1,
          pathCode: S.PATH_CODE.ON_HIT,
          groupType: S.PATH_GROUP_TYPE.SEQUENTIAL,
          originKind: 'SOURCE',
          selectionKind: 'FIXED',
          resultBlock: {
            id: `${S.equipmentChildId(S.equipId(380), 0x212, 1)}__result`,
            resultKind: 'SEQUENCE',
            outcomes: [
              {
                id: S.equipmentChildId(S.equipId(380), 0x212, 1),
                effectKind: S.EFFECT_KIND.DAMAGE,
                damageTypeId: S.damageTypeId('BLUDGEONING'),
                valueKind: S.DAMAGE_VALUE_KIND.DICE,
                scalingKind: S.SCALING.NONE,
                diceConfig: '1d4'
              },
              {
                id: S.equipmentChildId(S.equipId(380), 0x212, 2),
                effectKind: S.EFFECT_KIND.DAMAGE,
                damageTypeId: S.damageTypeId('PIERCING'),
                valueKind: S.DAMAGE_VALUE_KIND.DICE,
                scalingKind: S.SCALING.NONE,
                diceConfig: '1d4'
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
