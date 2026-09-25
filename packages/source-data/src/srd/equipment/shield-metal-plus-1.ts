import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { shieldMetal } from './shield-metal.js'
import * as S from './shared.js'

export const shieldMetalPlus1: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(358),
  label: 'Shield +1',
  description: S.MAGIC_SHIELD_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: shieldMetal.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_UNCOMMON,
  modifiers: S.magicArmorModifiers(S.equipId(358), 1),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
