import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { sling } from './sling.js'
import * as S from './shared.js'

export const slingPlus1: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(297),
  label: 'Sling +1',
  description: S.MAGIC_WEAPON_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: sling.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_UNCOMMON,
  modifiers: S.rangedMagicWeaponModifiers(S.equipId(297), 1),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
