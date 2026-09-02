import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const spikedShield: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(382),
  label: 'Spiked Shield',
  description: null,
  category: S.EQUIPMENT_CATEGORY_CODE.SHIELD,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MELEE],
  armorClass: 2,
  modifiers: S.meleeWeaponAbilityModifiers(S.equipId(382)),
  effects: S.meleeWeaponEffects(S.equipId(382), 'PIERCING', '1d6'),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
