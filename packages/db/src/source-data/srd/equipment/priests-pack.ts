import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const priestsPack: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(187),
  label: "Priest's Pack",
  description: "Includes a backpack, a blanket, 10 candles, a tinderbox, an alms box, 2 blocks of incense, a censer, vestments, 2 days of rations, and a waterskin.",
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(19),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  contains: [
    { equipmentId: S.equipId(105), quantity: 1 }, // Backpack
    { equipmentId: S.equipId(125), quantity: 1 }, // Blanket
    { equipmentId: S.equipId(129), quantity: 10 }, // Candle x10
    { equipmentId: S.equipId(178), quantity: 1 }, // Tinderbox
    { equipmentId: S.equipId(376), quantity: 1 }, // Alms Box
    { equipmentId: S.equipId(361), quantity: 2 }, // Incense x2
    { equipmentId: S.equipId(377), quantity: 1 }, // Censer
    { equipmentId: S.equipId(362), quantity: 1 }, // Vestments
    { equipmentId: S.equipId(166), quantity: 2 }, // Rations x2
    { equipmentId: S.equipId(117), quantity: 1 } // Waterskin
  ]
}
