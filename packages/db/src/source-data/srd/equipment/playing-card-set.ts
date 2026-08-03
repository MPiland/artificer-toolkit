import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const playingCardSet: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(79),
  label: 'Playing Card Set',
  description: S.GAMING_SET_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  cost: S.sp(5),
  weight: S.lbs(0),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
