import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const fineClothes: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(133),
    label: 'Fine Clothes',
    description: "Elegant attire of high-quality fabric, appropriate for nobles and formal occasions.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [S.EQUIPMENT_PROPERTY_CODE.CLOTHING],
    abilities: [],
    cost: S.gp(15),
    weight: S.lbs(6),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
