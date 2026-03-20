import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { scaleMail } from './scale-mail.js'
import * as S from './shared.js'

export const scaleMailPlus1: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(321),
  label: 'Scale Mail +1',
  description: 'You have a +1 bonus to AC while wearing this magic armor.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: scaleMail.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: scaleMail.weight,
  rarityId: S.RARITY_UNCOMMON,
  maxBonus: 1,
  modifiers: S.magicArmorModifiers(S.equipId(321), 1),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
