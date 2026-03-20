import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { scimitar } from './scimitar.js'
import * as S from './shared.js'

export const scimitarPlus1: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(213),
  label: 'Scimitar +1',
  description: 'You have a +1 bonus to attack and damage rolls made with this magic weapon.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: scimitar.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: S.lbs(3),
  rarityId: S.RARITY_UNCOMMON,
  maxBonus: 1,
  modifiers: S.meleeMagicWeaponModifiers(S.equipId(213), 1),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
