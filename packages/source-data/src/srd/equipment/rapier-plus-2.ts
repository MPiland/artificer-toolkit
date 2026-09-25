import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { rapier } from './rapier.js'
import * as S from './shared.js'

export const rapierPlus2: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(211),
  label: 'Rapier +2',
  description: S.MAGIC_WEAPON_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: rapier.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_RARE,
  modifiers: S.meleeMagicWeaponModifiers(S.equipId(211), 2),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
