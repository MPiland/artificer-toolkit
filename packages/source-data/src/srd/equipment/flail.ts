import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const flail: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(16),
  label: 'Flail',
  description: null,
  category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MARTIAL, S.EQUIPMENT_PROPERTY_CODE.MELEE],
  modifiers: S.meleeWeaponAbilityModifiers(S.equipId(16)),
  effects: S.meleeWeaponEffects(S.equipId(16), 'BLUDGEONING', '1d8', S.EQUIPMENT_GRIP.ONE_HANDED),
  cost: S.gp(10),
  weight: S.lbs(2),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
