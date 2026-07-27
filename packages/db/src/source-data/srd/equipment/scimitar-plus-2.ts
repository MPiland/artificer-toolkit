import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { scimitar } from './scimitar.js'
import * as S from './shared.js'

export const scimitarPlus2: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(214),
  label: 'Scimitar +2',
  description: 'You have a +2 bonus to attack and damage rolls made with this magic weapon.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: scimitar.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_RARE,
  maxBonus: 2,
  modifiers: S.meleeMagicWeaponModifiers(S.equipId(214), 2),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
