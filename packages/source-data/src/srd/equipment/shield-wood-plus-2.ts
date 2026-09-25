import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { shieldWood } from './shield-wood.js'
import * as S from './shared.js'

export const shieldWoodPlus2: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(356),
  label: 'Shield +2',
  description: S.MAGIC_SHIELD_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: shieldWood.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_RARE,
  modifiers: S.magicArmorModifiers(S.equipId(356), 2),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
