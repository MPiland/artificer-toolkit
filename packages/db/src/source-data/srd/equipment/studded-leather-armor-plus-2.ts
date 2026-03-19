import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { studdedLeatherArmor } from './studded-leather-armor.js'
import * as S from './shared.js'

export const studdedLeatherArmorPlus2: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(199),
  label: 'Studded Leather Armor +2',
  description: 'You have a +2 bonus to AC while wearing this magic armor.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: studdedLeatherArmor.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: studdedLeatherArmor.weight,
  rarityId: S.RARITY_RARE,
  maxBonus: 2,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
