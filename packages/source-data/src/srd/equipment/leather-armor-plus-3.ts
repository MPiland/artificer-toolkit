import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { leatherArmor } from './leather-armor.js'
import * as S from './shared.js'

export const leatherArmorPlus3: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(311),
  label: 'Leather Armor +3',
  description: S.MAGIC_ARMOR_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: leatherArmor.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_VERY_RARE,
  modifiers: S.magicArmorModifiers(S.equipId(311), 3),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
