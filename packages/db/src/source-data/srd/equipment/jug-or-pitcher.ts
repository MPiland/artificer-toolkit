import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const jugOrPitcher: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(113),
  label: 'Jug or Pitcher',
  description: null,
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [S.EQUIPMENT_PROPERTY_CODE.CONTAINER],
  cost: S.cp(2),
  weight: S.lbs(4),
  capacity: { amount: 1, unit: S.MEASUREMENT_UNIT_CODE.GALLONS },
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
