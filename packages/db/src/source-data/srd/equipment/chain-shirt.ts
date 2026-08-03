import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const chainShirt: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(42),
  label: 'Chain Shirt',
  description: "Made of interlocking metal rings, a chain shirt is worn between layers of clothing or leather. This armor offers modest protection to the wearer's upper body and allows the sound of the rings rubbing against one another to be muffled by outer layers.",
  category: S.EQUIPMENT_CATEGORY_CODE.ARMOR,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MEDIUM],
  armorClass: 13,
  cost: S.gp(50),
  weight: S.lbs(20),
  rarityId: S.RARITY_COMMON,
  modifiers: S.mediumArmorModifiers(S.equipId(42)),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
