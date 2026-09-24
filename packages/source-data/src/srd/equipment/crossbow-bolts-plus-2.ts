import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { crossbowBolts20 } from './crossbow-bolts-20.js'
import * as S from './shared.js'

export const crossbowBoltsPlus2: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(349),
  label: 'Crossbow Bolts +2',
  description: S.MAGIC_AMMUNITION_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: crossbowBolts20.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.AMMUNITION, S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  effects: [S.magicAmmunitionExpirationEffect(S.equipId(349))],
  rarityId: S.RARITY_RARE,
  maxBonus: 2,
  modifiers: S.magicAmmoModifiers(S.equipId(349), 2),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
