import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { sickle } from './sickle.js'
import * as S from './shared.js'

export const sicklePlus3: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(287),
  label: 'Sickle +3',
  description: S.MAGIC_WEAPON_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: sickle.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_VERY_RARE,
  modifiers: S.meleeMagicWeaponModifiers(S.equipId(287), 3),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
