import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const scholarsPack: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(188),
  label: "Scholar's Pack",
  description: 'Books, inks, and writing materials for a learned academic or researcher.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(40),
  weight: S.lbs(0),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  contains: [
    { equipmentId: S.equipId(105), quantity: 1 }, // Backpack
    { equipmentId: S.equipId(127), quantity: 1 }, // Book
    { equipmentId: S.equipId(144), quantity: 1 }, // Ink bottle
    { equipmentId: S.equipId(145), quantity: 1 }, // Ink Pen
    { equipmentId: S.equipId(159), quantity: 10 } // Parchment x10
  ]
}
