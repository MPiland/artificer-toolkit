import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { lightCrossbow } from './light-crossbow.js'
import * as S from './shared.js'

export const lightCrossbowPlus2: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(292),
  label: 'Light Crossbow +2',
  description: S.MAGIC_WEAPON_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: lightCrossbow.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_RARE,
  modifiers: S.rangedMagicWeaponModifiers(S.equipId(292), 2),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
