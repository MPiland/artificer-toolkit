import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { hideArmor } from './hide-armor.js'
import * as S from './shared.js'

export const hideArmorPlus2: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(202),
  label: 'Hide Armor +2',
  description: 'You have a +2 bonus to AC while wearing this magic armor.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: hideArmor.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: hideArmor.weight,
  rarityId: S.RARITY_RARE,
  maxBonus: 2,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
