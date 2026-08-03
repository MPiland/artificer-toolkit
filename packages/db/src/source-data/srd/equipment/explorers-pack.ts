import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const explorersPack: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(186),
  label: "Explorer's Pack",
  description: "Includes a backpack, a bedroll, a mess kit, a tinderbox, 10 torches, 10 days of rations, and a waterskin. The pack also has 50 feet of hempen rope strapped to the side of it.",
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(10),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  contains: [
    { equipmentId: S.equipId(105), quantity: 1 }, // Backpack
    { equipmentId: S.equipId(123), quantity: 1 }, // Bedroll
    { equipmentId: S.equipId(154), quantity: 1 }, // Mess Kit
    { equipmentId: S.equipId(178), quantity: 1 }, // Tinderbox
    { equipmentId: S.equipId(179), quantity: 10 }, // Torch x10
    { equipmentId: S.equipId(166), quantity: 10 }, // Rations x10
    { equipmentId: S.equipId(117), quantity: 1 }, // Waterskin
    { equipmentId: S.equipId(167), quantity: 1 } // Rope hempen
  ]
}
