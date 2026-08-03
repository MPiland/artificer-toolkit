import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const paddedArmor: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(38),
  label: 'Padded Armor',
  description: "Padded armor consists of quilted layers of cloth and batting.",
  category: S.EQUIPMENT_CATEGORY_CODE.ARMOR,
  properties: [S.EQUIPMENT_PROPERTY_CODE.LIGHT],
  armorClass: 11,
  cost: S.gp(5),
  weight: S.lbs(8),
  rarityId: S.RARITY_COMMON,
  modifiers: [
    ...S.lightArmorModifiers(S.equipId(38)),
    S.stealthDisadvantageModifier(S.equipId(38), 2)
  ],
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
