import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const candle: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(129),
  label: 'Candle',
  description: 'A tallow or wax candle that sheds dim light in a 5-foot radius for 1 hour.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  attributes: [S.EQUIPMENT_ATTRIBUTE.STACKABLE],
  cost: S.cp(1),
  weight: S.lbs(0),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
