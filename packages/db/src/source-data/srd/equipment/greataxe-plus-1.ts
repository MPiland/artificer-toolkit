import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { greataxe } from './greataxe.js'
import * as S from './shared.js'

export const greataxePlus1: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(264),
  label: 'Greataxe +1',
  description: 'You have a +1 bonus to attack and damage rolls made with this magic weapon.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: greataxe.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_UNCOMMON,
  maxBonus: 1,
  modifiers: S.meleeMagicWeaponModifiers(S.equipId(264), 1),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
