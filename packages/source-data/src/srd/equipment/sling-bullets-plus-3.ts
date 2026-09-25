import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { slingBullets20 } from './sling-bullets-20.js'
import * as S from './shared.js'

export const slingBulletsPlus3: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(353),
  label: 'Sling Bullets +3',
  description: S.MAGIC_AMMUNITION_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: slingBullets20.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.AMMUNITION, S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  effects: [S.magicAmmunitionExpirationEffect(S.equipId(353))],
  rarityId: S.RARITY_VERY_RARE,
  modifiers: S.magicAmmoModifiers(S.equipId(353), 3),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
