import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { halfPlateArmor } from './half-plate-armor.js'
import * as S from './shared.js'

export const halfPlateArmorPlus1: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(327),
  label: 'Half Plate Armor +1',
  description: 'You have a +1 bonus to AC while wearing this magic armor.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: halfPlateArmor.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: halfPlateArmor.weight,
  rarityId: S.RARITY_UNCOMMON,
  maxBonus: 1,
  modifiers: S.magicArmorModifiers(S.equipId(327), 1),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
