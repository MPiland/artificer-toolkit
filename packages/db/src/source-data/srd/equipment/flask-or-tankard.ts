import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const flaskOrTankard: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(111),
  label: 'Flask or Tankard',
  description: null,
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [
    S.EQUIPMENT_PROPERTY_CODE.CONTAINER,
    S.EQUIPMENT_PROPERTY_CODE.FLASK,
    S.EQUIPMENT_PROPERTY_CODE.DRINK
  ],
  cost: S.cp(2),
  weight: S.lbs(1),
  capacity: { amount: 0.5, unit: S.MEASUREMENT_UNIT_CODE.QUARTS },
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
