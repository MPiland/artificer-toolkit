import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { warhammer } from './warhammer.js'
import * as S from './shared.js'

export const warhammerPlus2: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(226),
  label: 'Warhammer +2',
  description: S.MAGIC_WEAPON_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: warhammer.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_RARE,
  modifiers: S.meleeMagicWeaponModifiers(S.equipId(226), 2),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
