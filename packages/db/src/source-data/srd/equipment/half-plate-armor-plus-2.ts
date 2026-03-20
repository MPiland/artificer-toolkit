import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { halfPlateArmor } from './half-plate-armor.js'
import * as S from './shared.js'

export const halfPlateArmorPlus2: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(328),
  label: 'Half Plate Armor +2',
  description: 'You have a +2 bonus to AC while wearing this magic armor.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: halfPlateArmor.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: halfPlateArmor.weight,
  rarityId: S.RARITY_RARE,
  maxBonus: 2,
  modifiers: S.magicArmorModifiers(S.equipId(328), 2),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
