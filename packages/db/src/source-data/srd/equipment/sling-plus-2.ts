import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { sling } from './sling.js'
import * as S from './shared.js'

export const slingPlus2: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(298),
  label: 'Sling +2',
  description: 'You have a +2 bonus to attack and damage rolls made with this magic weapon.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: sling.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_RARE,
  maxBonus: 2,
  modifiers: S.rangedMagicWeaponModifiers(S.equipId(298), 2),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
