import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { halberd } from './halberd.js'
import * as S from './shared.js'

export const halberdPlus2: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(193),
  label: 'Halberd +2',
  description: S.MAGIC_WEAPON_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: halberd.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_RARE,
  modifiers: S.meleeMagicWeaponModifiers(S.equipId(193), 2),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
