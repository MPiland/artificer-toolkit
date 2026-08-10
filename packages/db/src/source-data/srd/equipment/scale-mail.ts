import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const scaleMail: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(43),
  label: 'Scale Mail',
  description:
    'This armor consists of a coat and leggings (and perhaps a separate skirt) of leather covered with overlapping pieces of metal, much like the scales of a fish. The suit includes gauntlets.',
  category: S.EQUIPMENT_CATEGORY_CODE.ARMOR,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MEDIUM],
  armorClass: 14,
  cost: S.gp(50),
  weight: S.lbs(45),
  rarityId: S.RARITY_COMMON,
  modifiers: [
    ...S.mediumArmorModifiers(S.equipId(43)),
    S.stealthDisadvantageModifier(S.equipId(43), 2)
  ],
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
