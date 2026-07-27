import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { mace } from './mace.js'
import * as S from './shared.js'

export const macePlus3: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(284),
  label: 'Mace +3',
  description: 'You have a +3 bonus to attack and damage rolls made with this magic weapon.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: mace.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_VERY_RARE,
  maxBonus: 3,
  modifiers: S.meleeMagicWeaponModifiers(S.equipId(284), 3),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
