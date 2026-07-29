import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const breastplate: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(44),
  label: 'Breastplate',
  description: 'A fitted metal chest piece with leather backing.',
  category: S.EQUIPMENT_CATEGORY_CODE.ARMOR,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MEDIUM],
  armorClass: 14,
  cost: S.gp(400),
  weight: S.lbs(20),
  rarityId: S.RARITY_COMMON,
  modifiers: S.mediumArmorModifiers(S.equipId(44)),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
