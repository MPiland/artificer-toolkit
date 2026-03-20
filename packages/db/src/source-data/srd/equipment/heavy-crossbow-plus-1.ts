import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { heavyCrossbow } from './heavy-crossbow.js'
import * as S from './shared.js'

export const heavyCrossbowPlus1: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(237),
  label: 'Heavy Crossbow +1',
  description: 'You have a +1 bonus to attack and damage rolls made with this magic weapon.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: heavyCrossbow.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: S.lbs(18),
  rarityId: S.RARITY_UNCOMMON,
  maxBonus: 1,
  modifiers: S.rangedMagicWeaponModifiers(S.equipId(237), 1),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
