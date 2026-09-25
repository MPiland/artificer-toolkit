import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { quarterstaff } from './quarterstaff.js'
import * as S from './shared.js'

export const quarterstaffPlus1: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(300),
  label: 'Quarterstaff +1',
  description: S.MAGIC_WEAPON_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: quarterstaff.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_UNCOMMON,
  modifiers: S.meleeMagicWeaponModifiers(S.equipId(300), 1),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
