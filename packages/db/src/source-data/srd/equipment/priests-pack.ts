import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const priestsPack: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(187),
    label: "Priest's Pack",
    description: "Devotional supplies and basic provisions for a traveling cleric or holy person.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    cost: S.gp(19),
    weight: S.lbs(0),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    contains: [
      { equipmentId: S.equipId(105), quantity: 1 },  // Backpack
      { equipmentId: S.equipId(125), quantity: 1 },  // Blanket
      { equipmentId: S.equipId(129), quantity: 10 }, // Candle x10
      { equipmentId: S.equipId(178), quantity: 1 },  // Tinderbox
      { equipmentId: S.equipId(166), quantity: 2 },  // Rations x2
      { equipmentId: S.equipId(117), quantity: 1 },  // Waterskin
    ],
  }
