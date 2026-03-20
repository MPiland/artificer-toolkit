import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { dart } from './dart.js'
import * as S from './shared.js'

export const dartPlus3: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(257),
  label: 'Dart +3',
  description: 'You have a +3 bonus to attack and damage rolls made with this magic weapon.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: dart.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: S.lbs(0.25),
  rarityId: S.RARITY_VERY_RARE,
  maxBonus: 3,
  modifiers: S.rangedMagicWeaponModifiers(S.equipId(257), 3),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
