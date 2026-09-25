import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { flail } from './flail.js'
import * as S from './shared.js'

export const flailPlus1: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(258),
  label: 'Flail +1',
  description: S.MAGIC_WEAPON_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: flail.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_UNCOMMON,
  modifiers: S.meleeMagicWeaponModifiers(S.equipId(258), 1),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
