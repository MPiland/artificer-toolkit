import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const pouch: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(115),
    label: 'Pouch',
    description: "A small cloth or leather bag for carrying coins or other small items.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [S.EQUIPMENT_PROPERTY_CODE.CONTAINER],
    abilities: [],
    cost: S.sp(5),
    weight: S.lbs(1),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
