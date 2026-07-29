import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const entertainersPack: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(185),
  label: "Entertainer's Pack",
  description: 'Supplies for a performer on the road, including costumes and creature comforts.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(40),
  weight: S.lbs(0),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
  contains: [
    { equipmentId: S.equipId(105), quantity: 1 }, // Backpack
    { equipmentId: S.equipId(123), quantity: 1 }, // Bedroll
    { equipmentId: S.equipId(132), quantity: 1 }, // Costume Clothes
    { equipmentId: S.equipId(129), quantity: 5 }, // Candle x5
    { equipmentId: S.equipId(166), quantity: 5 }, // Rations x5
    { equipmentId: S.equipId(117), quantity: 1 }, // Waterskin
    { equipmentId: S.equipId(80), quantity: 1 } // Disguise Kit
  ]
}
