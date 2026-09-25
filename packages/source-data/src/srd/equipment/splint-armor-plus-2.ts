import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { splintArmor } from './splint-armor.js'
import * as S from './shared.js'

export const splintArmorPlus2: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(337),
  label: 'Splint Armor +2',
  description: S.MAGIC_ARMOR_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: splintArmor.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_RARE,
  modifiers: S.magicArmorModifiers(S.equipId(337), 2),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
