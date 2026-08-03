import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const littleBagOfSand: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(378),
  label: 'Little Bag of Sand',
  description: null,
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
