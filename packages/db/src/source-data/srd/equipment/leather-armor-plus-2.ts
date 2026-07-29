import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { leatherArmor } from './leather-armor.js'
import * as S from './shared.js'

export const leatherArmorPlus2: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(310),
  label: 'Leather Armor +2',
  description: 'You have a +2 bonus to AC while wearing this magic armor.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: leatherArmor.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_RARE,
  maxBonus: 2,
  modifiers: S.magicArmorModifiers(S.equipId(310), 2),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
