import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { battleaxe } from './battleaxe.js'
import * as S from './shared.js'

export const battleaxePlus1: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(246),
  label: 'Battleaxe +1',
  description: 'You have a +1 bonus to attack and damage rolls made with this magic weapon.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: battleaxe.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: S.lbs(4),
  rarityId: S.RARITY_UNCOMMON,
  maxBonus: 1,
  modifiers: S.meleeMagicWeaponModifiers(S.equipId(246), 1),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
