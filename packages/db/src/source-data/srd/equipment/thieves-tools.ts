import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const thievesTools: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(85),
  label: "Thieves' Tools",
  description: 'A small file, a set of lock picks, a small mirror, a pair of scissors, and pliers.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  cost: S.gp(25),
  weight: S.lbs(1),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
