import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const waterskin: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(117),
    label: 'Waterskin',
    description: "A treated animal-hide pouch for carrying up to 4 pints of water or other liquid.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [S.EQUIPMENT_PROPERTY_CODE.CONTAINER],
    cost: S.sp(2),
    weight: S.lbs(5),
    capacity: { amount: 2, unit: S.MEASUREMENT_UNIT_CODE.QUARTS },
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
