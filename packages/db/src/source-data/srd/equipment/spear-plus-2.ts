import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { spear } from './spear.js'
import * as S from './shared.js'

export const spearPlus2: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(289),
  label: 'Spear +2',
  description: 'You have a +2 bonus to attack and damage rolls made with this magic weapon.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: spear.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: S.lbs(3),
  rarityId: S.RARITY_RARE,
  maxBonus: 2,
  modifiers: S.thrownMagicWeaponModifiers(S.equipId(289), 2),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
