import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { breastplate } from './breastplate.js'
import * as S from './shared.js'

export const breastplatePlus3: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(326),
  label: 'Breastplate +3',
  description: S.MAGIC_ARMOR_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: breastplate.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_VERY_RARE,
  maxBonus: 3,
  modifiers: S.magicArmorModifiers(S.equipId(326), 3),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
