import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { pike } from './pike.js'
import * as S from './shared.js'

export const pikePlus2: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(208),
  label: 'Pike +2',
  description: S.MAGIC_WEAPON_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: pike.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_RARE,
  modifiers: S.meleeMagicWeaponModifiers(S.equipId(208), 2),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
