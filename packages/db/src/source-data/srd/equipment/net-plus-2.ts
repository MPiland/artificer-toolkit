import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { net } from './net.js'
import * as S from './shared.js'

export const netPlus2: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(244),
  label: 'Net +2',
  description: 'You have a +2 bonus to attack rolls made with this magic weapon.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: net.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: S.lbs(3),
  rarityId: S.RARITY_RARE,
  maxBonus: 2,
  modifiers: S.rangedMagicWeaponModifiers(S.equipId(244), 2),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
