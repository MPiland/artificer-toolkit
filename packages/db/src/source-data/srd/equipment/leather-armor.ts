import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const leatherArmor: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(39),
  label: 'Leather Armor',
  description: "The breastplate and shoulder protectors of this armor are made of leather that has been stiffened by being boiled in oil. The rest of the armor is made of softer and more flexible materials.",
  category: S.EQUIPMENT_CATEGORY_CODE.ARMOR,
  properties: [S.EQUIPMENT_PROPERTY_CODE.LIGHT],
  armorClass: 11,
  cost: S.gp(10),
  weight: S.lbs(10),
  rarityId: S.RARITY_COMMON,
  modifiers: S.lightArmorModifiers(S.equipId(39)),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
