import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { studdedLeatherArmor } from './studded-leather-armor.js'
import * as S from './shared.js'

export const studdedLeatherArmorPlus3: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(314),
  label: 'Studded Leather Armor +3',
  description: 'You have a +3 bonus to AC while wearing this magic armor.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: studdedLeatherArmor.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_VERY_RARE,
  maxBonus: 3,
  modifiers: S.magicArmorModifiers(S.equipId(314), 3),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
