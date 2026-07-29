import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const abacus: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(118),
  label: 'Abacus',
  description: 'A counting frame with sliding beads used for arithmetic calculations.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(2),
  weight: S.lbs(2),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
