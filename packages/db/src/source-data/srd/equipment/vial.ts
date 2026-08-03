import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const vial: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(180),
  label: 'Vial',
  description: null,
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [S.EQUIPMENT_PROPERTY_CODE.CONTAINER, S.EQUIPMENT_PROPERTY_CODE.VIAL],
  cost: S.gp(1),
  weight: S.lbs(0),
  capacity: { amount: 4, unit: S.MEASUREMENT_UNIT_CODE.OUNCES },
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
