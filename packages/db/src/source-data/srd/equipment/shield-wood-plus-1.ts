import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { shieldWood } from './shield-wood.js'
import * as S from './shared.js'

export const shieldWoodPlus1: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(355),
  label: 'Shield +1',
  description: 'You have a +1 bonus to AC while wielding this magic shield.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: shieldWood.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: S.lbs(6),
  rarityId: S.RARITY_UNCOMMON,
  maxBonus: 1,
  modifiers: S.magicArmorModifiers(S.equipId(355), 1),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
