import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const chest: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(110),
    label: 'Chest',
    description: "A sturdy locked box for securing valuables or transporting goods.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [S.EQUIPMENT_PROPERTY_CODE.CONTAINER],
    cost: S.gp(5),
    weight: S.lbs(25),
    capacity: { amount: 300, unit: S.MEASUREMENT_UNIT_CODE.POUNDS },
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
