import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { ringMail } from './ring-mail.js'
import * as S from './shared.js'

export const ringMailPlus3: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(332),
  label: 'Ring Mail +3',
  description: S.MAGIC_ARMOR_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: ringMail.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_VERY_RARE,
  modifiers: S.magicArmorModifiers(S.equipId(332), 3),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
