import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { glaive } from './glaive.js'
import * as S from './shared.js'

export const glaivePlus3: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(263),
  label: 'Glaive +3',
  description: S.MAGIC_WEAPON_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: glaive.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_VERY_RARE,
  modifiers: S.meleeMagicWeaponModifiers(S.equipId(263), 3),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
