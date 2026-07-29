import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const fishingTackle: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(137),
  label: 'Fishing Tackle',
  description: 'A rod, line, hooks, floats, and bait for catching fish.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(1),
  weight: S.lbs(4),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
