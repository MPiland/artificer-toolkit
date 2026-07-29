import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const ladder10Foot: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(147),
  label: 'Ladder (10-foot)',
  description: 'A wooden ladder 10 feet long for climbing walls or descending into pits.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.sp(1),
  weight: S.lbs(25),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
