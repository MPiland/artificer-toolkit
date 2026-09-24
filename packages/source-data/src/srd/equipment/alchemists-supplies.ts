import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const alchemistsSupplies: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(51),
  label: "Alchemist's Supplies",
  description: S.ARTISANS_TOOLS_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  cost: S.gp(50),
  weight: S.lbs(8),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
