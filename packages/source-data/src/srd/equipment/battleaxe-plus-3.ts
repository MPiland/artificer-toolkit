import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { battleaxe } from './battleaxe.js'
import * as S from './shared.js'

export const battleaxePlus3: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(248),
  label: 'Battleaxe +3',
  description: S.MAGIC_WEAPON_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: battleaxe.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_VERY_RARE,
  modifiers: S.meleeMagicWeaponModifiers(S.equipId(248), 3),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
