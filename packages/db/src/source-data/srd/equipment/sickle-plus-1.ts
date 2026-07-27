import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { sickle } from './sickle.js'
import * as S from './shared.js'

export const sicklePlus1: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(285),
  label: 'Sickle +1',
  description: 'You have a +1 bonus to attack and damage rolls made with this magic weapon.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: sickle.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_UNCOMMON,
  maxBonus: 1,
  modifiers: S.meleeMagicWeaponModifiers(S.equipId(285), 1),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
