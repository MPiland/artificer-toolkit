import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const prayerWheel: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(363),
  label: 'Prayer Wheel',
  description: 'A cylindrical wheel on a spindle used in religious practice to accumulate wisdom and good karma.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  abilities: [],
  cost: S.gp(5),
  weight: S.lbs(1),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
