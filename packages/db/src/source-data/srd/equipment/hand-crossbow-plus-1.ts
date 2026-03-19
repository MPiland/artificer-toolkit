import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { handCrossbow } from './hand-crossbow.js'
import * as S from './shared.js'

export const handCrossbowPlus1: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(234),
  label: 'Hand Crossbow +1',
  description: 'You have a +1 bonus to attack and damage rolls made with this magic weapon.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: handCrossbow.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: S.lbs(3),
  rarityId: S.RARITY_UNCOMMON,
  maxBonus: 1,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
