import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { greatsword } from './greatsword.js'
import * as S from './shared.js'

export const greatswordPlus1: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(270),
  label: 'Greatsword +1',
  description: 'You have a +1 bonus to attack and damage rolls made with this magic weapon.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: greatsword.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: S.lbs(6),
  rarityId: S.RARITY_UNCOMMON,
  maxBonus: 1,
  modifiers: S.meleeMagicWeaponModifiers(S.equipId(270), 1),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
