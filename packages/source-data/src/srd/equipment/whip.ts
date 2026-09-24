import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const whip: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(32),
  label: 'Whip',
  description: null,
  category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
  properties: [
    S.EQUIPMENT_PROPERTY_CODE.MARTIAL,
    S.EQUIPMENT_PROPERTY_CODE.MELEE,
    S.EQUIPMENT_PROPERTY_CODE.FINESSE,
    S.EQUIPMENT_PROPERTY_CODE.REACH
  ],
  effects: S.meleeReachWeaponEffects(S.equipId(32), 'SLASHING', '1d4'),
  cost: S.gp(2),
  weight: S.lbs(3),
  rarityId: S.RARITY_COMMON,
  modifiers: S.finesseWeaponModifiers(S.equipId(32)),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
