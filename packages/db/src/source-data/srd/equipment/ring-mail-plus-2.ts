import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { ringMail } from './ring-mail.js'
import * as S from './shared.js'

export const ringMailPlus2: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(331),
  label: 'Ring Mail +2',
  description: 'You have a +2 bonus to AC while wearing this magic armor.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: ringMail.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: ringMail.weight,
  rarityId: S.RARITY_RARE,
  maxBonus: 2,
  modifiers: S.magicArmorModifiers(S.equipId(331), 2),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
