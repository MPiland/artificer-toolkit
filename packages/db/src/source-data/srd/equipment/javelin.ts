import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const javelin: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(5),
  label: 'Javelin',
  description: 'A light spear designed for throwing.',
  category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
  properties: [
    S.EQUIPMENT_PROPERTY_CODE.SIMPLE,
    S.EQUIPMENT_PROPERTY_CODE.MELEE,
    S.EQUIPMENT_PROPERTY_CODE.THROWN
  ],
  modifiers: S.thrownWeaponAbilityModifiers(S.equipId(5)),
  effects: S.thrownWeaponEffects(S.equipId(5), 'PIERCING', '1d6', 30),
  cost: S.sp(5),
  weight: S.lbs(2),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
