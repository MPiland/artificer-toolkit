import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { chainShirt } from './chain-shirt.js'
import * as S from './shared.js'

export const chainShirtPlus3: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(206),
  label: 'Chain Shirt +3',
  description: 'You have a +3 bonus to AC while wearing this magic armor.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: chainShirt.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: chainShirt.weight,
  rarityId: S.RARITY_VERY_RARE,
  maxBonus: 3,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
