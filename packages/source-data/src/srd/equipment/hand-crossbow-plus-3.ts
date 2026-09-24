import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { handCrossbow } from './hand-crossbow.js'
import * as S from './shared.js'

export const handCrossbowPlus3: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(236),
  label: 'Hand Crossbow +3',
  description: S.MAGIC_WEAPON_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: handCrossbow.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_VERY_RARE,
  maxBonus: 3,
  modifiers: S.rangedMagicWeaponModifiers(S.equipId(236), 3),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
