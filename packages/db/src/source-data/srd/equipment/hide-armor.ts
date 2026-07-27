import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const hideArmor: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(41),
  label: 'Hide Armor',
  description: 'Crude armor made from thick furs and pelts.',
  category: S.EQUIPMENT_CATEGORY_CODE.ARMOR,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MEDIUM],
  armorClass: 12,
  cost: S.gp(10),
  weight: S.lbs(12),
  rarityId: S.RARITY_COMMON,
  modifiers: S.mediumArmorModifiers(S.equipId(41)),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
