import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const shieldMetal: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(354),
  label: 'Shield',
  description: S.SHIELD_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.SHIELD,
  properties: [S.EQUIPMENT_PROPERTY_CODE.METAL],
  armorClass: 2,
  cost: S.gp(10),
  weight: S.lbs(6),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
