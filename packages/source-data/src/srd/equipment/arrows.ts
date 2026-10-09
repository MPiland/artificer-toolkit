import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const arrows: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(99),
  label: 'Arrows',
  description: null,
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  attributes: [S.EQUIPMENT_ATTRIBUTE.STACKABLE],
  cost: S.cp(5),
  weight: S.lbs(0.05),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
