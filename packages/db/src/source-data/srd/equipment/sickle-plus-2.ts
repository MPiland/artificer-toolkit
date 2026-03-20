import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { sickle } from './sickle.js'
import * as S from './shared.js'

export const sicklePlus2: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(286),
  label: 'Sickle +2',
  description: 'You have a +2 bonus to attack and damage rolls made with this magic weapon.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: sickle.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: S.lbs(2),
  rarityId: S.RARITY_RARE,
  maxBonus: 2,
  modifiers: S.meleeMagicWeaponModifiers(S.equipId(286), 2),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
