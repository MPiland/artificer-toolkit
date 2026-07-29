import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { paddedArmor } from './padded-armor.js'
import * as S from './shared.js'

export const paddedArmorPlus1: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(306),
  label: 'Padded Armor +1',
  description: 'You have a +1 bonus to AC while wearing this magic armor.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: paddedArmor.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_UNCOMMON,
  maxBonus: 1,
  modifiers: S.magicArmorModifiers(S.equipId(306), 1),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
