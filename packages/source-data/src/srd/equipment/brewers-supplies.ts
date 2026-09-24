import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const brewersSupplies: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(52),
  label: "Brewer's Supplies",
  description: S.ARTISANS_TOOLS_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  cost: S.gp(20),
  weight: S.lbs(9),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
