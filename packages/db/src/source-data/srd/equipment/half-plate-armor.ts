import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const halfPlateArmor: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(45),
  label: 'Half Plate Armor',
  description: "Half plate consists of shaped metal plates that cover most of the wearer's body. It does not include leg protection beyond simple greaves that are attached with leather straps.",
  category: S.EQUIPMENT_CATEGORY_CODE.ARMOR,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MEDIUM],
  armorClass: 15,
  cost: S.gp(750),
  weight: S.lbs(40),
  rarityId: S.RARITY_COMMON,
  modifiers: [
    ...S.mediumArmorModifiers(S.equipId(45)),
    S.stealthDisadvantageModifier(S.equipId(45), 2)
  ],
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
