import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { chainShirt } from './chain-shirt.js'
import * as S from './shared.js'

export const chainShirtPlus2: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(319),
  label: 'Chain Shirt +2',
  description: S.MAGIC_ARMOR_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: chainShirt.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_RARE,
  modifiers: S.magicArmorModifiers(S.equipId(319), 2),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
