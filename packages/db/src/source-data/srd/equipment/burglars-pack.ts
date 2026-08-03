import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const burglarsPack: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(182),
  label: "Burglar's Pack",
  description: "Includes a backpack, a bag of 1,000 ball bearings, 10 feet of string, a bell, 5 candles, a crowbar, a hammer, 10 pitons, a hooded lantern, 2 flasks of oil, 5 days rations, a tinderbox, and a waterskin. The pack also has 50 feet of hempen rope strapped to the side of it.",
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(16),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  contains: [
    { equipmentId: S.equipId(105), quantity: 1 }, // Backpack
    { equipmentId: S.equipId(122), quantity: 1 }, // Ball Bearings
    { equipmentId: S.equipId(176), quantity: 1 }, // String (10 feet)
    { equipmentId: S.equipId(124), quantity: 1 }, // Bell
    { equipmentId: S.equipId(129), quantity: 5 }, // Candle x5
    { equipmentId: S.equipId(136), quantity: 1 }, // Crowbar
    { equipmentId: S.equipId(139), quantity: 1 }, // Hammer
    { equipmentId: S.equipId(161), quantity: 10 }, // Pitons x10
    { equipmentId: S.equipId(150), quantity: 1 }, // Hooded Lantern
    { equipmentId: S.equipId(157), quantity: 2 }, // Oil x2
    { equipmentId: S.equipId(166), quantity: 5 }, // Rations x5
    { equipmentId: S.equipId(178), quantity: 1 }, // Tinderbox
    { equipmentId: S.equipId(117), quantity: 1 }, // Waterskin
    { equipmentId: S.equipId(167), quantity: 1 } // Rope, hempen (50 feet)
  ]
}
