import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const basket: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(107),
  label: 'Basket',
  description: 'A woven container suitable for carrying produce or light goods.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [S.EQUIPMENT_PROPERTY_CODE.CONTAINER],
  cost: S.sp(4),
  weight: S.lbs(2),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
