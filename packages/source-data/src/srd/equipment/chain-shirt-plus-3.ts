import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { chainShirt } from './chain-shirt.js'
import * as S from './shared.js'

export const chainShirtPlus3: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(320),
  label: 'Chain Shirt +3',
  description: S.MAGIC_ARMOR_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: chainShirt.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_VERY_RARE,
  modifiers: S.magicArmorModifiers(S.equipId(320), 3),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
