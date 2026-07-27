import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { mace } from './mace.js'
import * as S from './shared.js'

export const macePlus1: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(282),
  label: 'Mace +1',
  description: 'You have a +1 bonus to attack and damage rolls made with this magic weapon.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: mace.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_UNCOMMON,
  maxBonus: 1,
  modifiers: S.meleeMagicWeaponModifiers(S.equipId(282), 1),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
