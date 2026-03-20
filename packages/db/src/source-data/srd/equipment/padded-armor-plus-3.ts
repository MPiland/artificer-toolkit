import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { paddedArmor } from './padded-armor.js'
import * as S from './shared.js'

export const paddedArmorPlus3: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(308),
  label: 'Padded Armor +3',
  description: 'You have a +3 bonus to AC while wearing this magic armor.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: paddedArmor.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: paddedArmor.weight,
  rarityId: S.RARITY_VERY_RARE,
  maxBonus: 3,
  modifiers: S.magicArmorModifiers(S.equipId(308), 3),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
