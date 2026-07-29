import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { halfPlateArmor } from './half-plate-armor.js'
import * as S from './shared.js'

export const halfPlateArmorPlus3: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(329),
  label: 'Half Plate Armor +3',
  description: 'You have a +3 bonus to AC while wearing this magic armor.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: halfPlateArmor.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_VERY_RARE,
  maxBonus: 3,
  modifiers: S.magicArmorModifiers(S.equipId(329), 3),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
