import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { spear } from './spear.js'
import * as S from './shared.js'

export const spearPlus2: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(289),
  label: 'Spear +2',
  description: S.MAGIC_WEAPON_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: spear.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_RARE,
  modifiers: S.thrownMagicWeaponModifiers(S.equipId(289), 2),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
