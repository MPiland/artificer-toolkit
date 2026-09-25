import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { lightCrossbow } from './light-crossbow.js'
import * as S from './shared.js'

export const lightCrossbowPlus3: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(293),
  label: 'Light Crossbow +3',
  description: S.MAGIC_WEAPON_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: lightCrossbow.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_VERY_RARE,
  modifiers: S.rangedMagicWeaponModifiers(S.equipId(293), 3),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
