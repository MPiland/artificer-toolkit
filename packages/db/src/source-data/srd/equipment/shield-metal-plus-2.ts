import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { shieldMetal } from './shield-metal.js'
import * as S from './shared.js'

export const shieldMetalPlus2: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(359),
  label: 'Shield +2',
  description: 'You have a +2 bonus to AC while wielding this magic shield.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: shieldMetal.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: S.lbs(6),
  rarityId: S.RARITY_RARE,
  maxBonus: 2,
  modifiers: S.magicArmorModifiers(S.equipId(359), 2),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
