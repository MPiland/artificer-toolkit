import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const backpack: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(105),
    label: 'Backpack',
    description: "A leather pack with multiple compartments for carrying adventuring gear.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [S.EQUIPMENT_PROPERTY_CODE.CONTAINER],
    abilities: [],
    cost: S.gp(2),
    weight: S.lbs(5),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
