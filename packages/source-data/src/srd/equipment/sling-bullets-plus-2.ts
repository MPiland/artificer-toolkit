import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { slingBullets } from './sling-bullets.js'
import * as S from './shared.js'

export const slingBulletsPlus2: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(352),
  label: 'Sling Bullets +2',
  description: S.MAGIC_AMMUNITION_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: slingBullets.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.AMMUNITION, S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  effects: [S.magicAmmunitionExpirationEffect(S.equipId(352))],
  rarityId: S.RARITY_RARE,
  modifiers: S.magicAmmoModifiers(S.equipId(352), 2),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
