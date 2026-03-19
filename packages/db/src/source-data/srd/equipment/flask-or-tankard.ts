import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const flaskOrTankard: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(111),
    label: 'Flask or Tankard',
    description: "A metal flask or ceramic tankard for drinking water, ale, or other beverages.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [S.EQUIPMENT_PROPERTY_CODE.CONTAINER],
    abilities: [],
    cost: S.cp(2),
    weight: S.lbs(1),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
