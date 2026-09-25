import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { blowgun } from './blowgun.js'
import * as S from './shared.js'

export const blowgunPlus1: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(231),
  label: 'Blowgun +1',
  description: S.MAGIC_WEAPON_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: blowgun.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_UNCOMMON,
  modifiers: S.rangedMagicWeaponModifiers(S.equipId(231), 1),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
