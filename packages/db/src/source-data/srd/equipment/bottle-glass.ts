import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const bottleGlass: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(108),
    label: 'Bottle (glass)',
    description: "A glass bottle suitable for holding liquids such as potions or wine.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [S.EQUIPMENT_PROPERTY_CODE.CONTAINER],
    abilities: [],
    cost: S.gp(2),
    weight: S.lbs(2),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
