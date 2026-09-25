import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { breastplate } from './breastplate.js'
import * as S from './shared.js'

export const breastplatePlus1: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(324),
  label: 'Breastplate +1',
  description: S.MAGIC_ARMOR_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: breastplate.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_UNCOMMON,
  modifiers: S.magicArmorModifiers(S.equipId(324), 1),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
