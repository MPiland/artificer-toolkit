import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { breastplate } from './breastplate.js'
import * as S from './shared.js'

export const breastplatePlus1: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(324),
  label: 'Breastplate +1',
  description: 'You have a +1 bonus to AC while wearing this magic armor.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: breastplate.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: breastplate.weight,
  rarityId: S.RARITY_UNCOMMON,
  maxBonus: 1,
  modifiers: S.magicArmorModifiers(S.equipId(324), 1),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
