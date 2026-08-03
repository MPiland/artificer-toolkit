import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const scholarsPack: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(188),
  label: "Scholar's Pack",
  description: "Includes a backpack, a book of lore, a bottle of ink, an ink pen, 10 sheets of parchment, a little bag of sand, and a small knife.",
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(40),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  contains: [
    { equipmentId: S.equipId(105), quantity: 1 }, // Backpack
    { equipmentId: S.equipId(127), quantity: 1 }, // Book
    { equipmentId: S.equipId(144), quantity: 1 }, // Ink bottle
    { equipmentId: S.equipId(145), quantity: 1 }, // Ink Pen
    { equipmentId: S.equipId(159), quantity: 10 }, // Parchment x10
    { equipmentId: S.equipId(378), quantity: 1 }, // Little Bag of Sand
    { equipmentId: S.equipId(379), quantity: 1 } // Small Knife
  ]
}
