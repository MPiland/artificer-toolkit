import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { heavyCrossbow } from './heavy-crossbow.js'
import * as S from './shared.js'

export const heavyCrossbowPlus1: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(237),
  label: 'Heavy Crossbow +1',
  description: S.MAGIC_WEAPON_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: heavyCrossbow.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_UNCOMMON,
  modifiers: S.rangedMagicWeaponModifiers(S.equipId(237), 1),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
