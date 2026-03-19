import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { crossbowBolts20 } from './crossbow-bolts-20.js'
import * as S from './shared.js'

export const crossbowBoltsPlus1: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(198),
  label: 'Crossbow Bolts +1',
  description: 'These 20 magic bolts grant a +1 bonus to attack and damage rolls made with them.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: crossbowBolts20.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.AMMUNITION, S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: S.lbs(1.5),
  rarityId: S.RARITY_UNCOMMON,
  maxBonus: 1,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
