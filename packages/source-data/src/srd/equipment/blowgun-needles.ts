import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const blowgunNeedles: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(100),
  label: 'Blowgun Needles',
  description: null,
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  attributes: [S.EQUIPMENT_ATTRIBUTE.STACKABLE],
  cost: S.cp(2),
  weight: S.lbs(0.02),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
