import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const sack: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(116),
    label: 'Sack',
    description: "A large cloth bag for carrying bulky or loose goods.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [S.EQUIPMENT_PROPERTY_CODE.CONTAINER],
    cost: S.cp(1),
    weight: S.lbs(0.5),
    capacity: { amount: 30, unit: S.MEASUREMENT_UNIT_CODE.POUNDS },
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
