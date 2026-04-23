import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const dungeoneersPack: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(184),
    label: "Dungeoneer's Pack",
    description: "Essentials for delving into dungeons and other underground environments.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    cost: S.gp(12),
    weight: S.lbs(0),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
    contains: [
      { equipmentId: S.equipId(105), quantity: 1 },  // Backpack
      { equipmentId: S.equipId(136), quantity: 1 },  // Crowbar
      { equipmentId: S.equipId(139), quantity: 1 },  // Hammer
      { equipmentId: S.equipId(146), quantity: 10 }, // Iron Spikes x10
      { equipmentId: S.equipId(179), quantity: 10 }, // Torch x10
      { equipmentId: S.equipId(178), quantity: 1 },  // Tinderbox
      { equipmentId: S.equipId(166), quantity: 10 }, // Rations x10
      { equipmentId: S.equipId(117), quantity: 1 },  // Waterskin
      { equipmentId: S.equipId(167), quantity: 1 },  // Rope hempen
    ],
  }
