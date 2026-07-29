import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const rope50FtSilk: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(168),
  label: 'Rope (50 ft, silk)',
  description: 'Fifty feet of lightweight silk rope, easier to handle and resistant to cutting.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(10),
  weight: S.lbs(5),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
