import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { hideArmor } from './hide-armor.js'
import * as S from './shared.js'

export const hideArmorPlus1: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(201),
  label: 'Hide Armor +1',
  description: 'You have a +1 bonus to AC while wearing this magic armor.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: hideArmor.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: hideArmor.weight,
  rarityId: S.RARITY_UNCOMMON,
  maxBonus: 1,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
