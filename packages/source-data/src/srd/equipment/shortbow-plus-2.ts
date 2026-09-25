import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { shortbow } from './shortbow.js'
import * as S from './shared.js'

export const shortbowPlus2: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(295),
  label: 'Shortbow +2',
  description: S.MAGIC_WEAPON_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: shortbow.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_RARE,
  modifiers: S.rangedMagicWeaponModifiers(S.equipId(295), 2),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
