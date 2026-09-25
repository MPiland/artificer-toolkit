import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const morningstar: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(24),
  label: 'Morningstar',
  description: null,
  category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MARTIAL, S.EQUIPMENT_PROPERTY_CODE.MELEE],
  modifiers: S.meleeWeaponAbilityModifiers(S.equipId(24)),
  effects: S.meleeWeaponEffects(S.equipId(24), 'PIERCING', '1d8', S.EQUIPMENT_GRIP.ONE_HANDED),
  cost: S.gp(15),
  weight: S.lbs(4),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
