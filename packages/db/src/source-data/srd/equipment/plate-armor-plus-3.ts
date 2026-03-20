import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { plateArmor } from './plate-armor.js'
import * as S from './shared.js'

export const plateArmorPlus3: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(341),
  label: 'Plate Armor +3',
  description: 'You have a +3 bonus to AC while wearing this magic armor.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: plateArmor.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: plateArmor.weight,
  rarityId: S.RARITY_VERY_RARE,
  maxBonus: 3,
  modifiers: S.magicArmorModifiers(S.equipId(341), 3),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
