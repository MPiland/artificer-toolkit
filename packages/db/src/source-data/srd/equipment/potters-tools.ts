import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const pottersTools: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(63),
  label: "Potter's Tools",
  description: 'A wheel, shaping tools, and glazing materials for crafting ceramic vessels.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  cost: S.gp(10),
  weight: S.lbs(3),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
