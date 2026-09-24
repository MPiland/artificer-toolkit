import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const diplomatsPack: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(183),
  label: "Diplomat's Pack",
  description:
    'Includes a chest, 2 cases for maps and scrolls, a set of fine clothes, a bottle of ink, an ink pen, a lamp, 2 flasks of oil, 5 sheets of paper, a vial of perfume, sealing wax, and soap.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(39),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  contains: [
    { equipmentId: S.equipId(110), quantity: 1 }, // Chest
    { equipmentId: S.equipId(114), quantity: 2 }, // Map/Scroll Case x2
    { equipmentId: S.equipId(133), quantity: 1 }, // Fine Clothes
    { equipmentId: S.equipId(144), quantity: 1 }, // Ink bottle
    { equipmentId: S.equipId(145), quantity: 1 }, // Ink Pen
    { equipmentId: S.equipId(148), quantity: 1 }, // Lamp
    { equipmentId: S.equipId(157), quantity: 2 }, // Oil x2
    { equipmentId: S.equipId(158), quantity: 5 }, // Paper x5
    { equipmentId: S.equipId(160), quantity: 1 }, // Perfume
    { equipmentId: S.equipId(169), quantity: 1 }, // Sealing Wax
    { equipmentId: S.equipId(173), quantity: 1 } // Soap
  ]
}
