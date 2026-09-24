import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const bucket: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(109),
  label: 'Bucket',
  description: null,
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [S.EQUIPMENT_PROPERTY_CODE.CONTAINER],
  cost: S.cp(5),
  weight: S.lbs(2),
  capacity: { amount: 3, unit: S.MEASUREMENT_UNIT_CODE.GALLONS },
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
