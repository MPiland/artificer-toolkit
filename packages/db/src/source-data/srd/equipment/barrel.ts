import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const barrel: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(106),
    label: 'Barrel',
    description: "A large wooden cask used to transport or store liquids and loose goods.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [S.EQUIPMENT_PROPERTY_CODE.CONTAINER],
    cost: S.gp(2),
    weight: S.lbs(70),
    capacity: { amount: 40, unit: S.MEASUREMENT_UNIT_CODE.GALLONS },
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
