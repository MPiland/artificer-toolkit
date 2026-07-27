import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { handCrossbow } from './hand-crossbow.js'
import * as S from './shared.js'

export const handCrossbowPlus3: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(236),
  label: 'Hand Crossbow +3',
  description: 'You have a +3 bonus to attack and damage rolls made with this magic weapon.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: handCrossbow.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_VERY_RARE,
  maxBonus: 3,
  modifiers: S.rangedMagicWeaponModifiers(S.equipId(236), 3),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
