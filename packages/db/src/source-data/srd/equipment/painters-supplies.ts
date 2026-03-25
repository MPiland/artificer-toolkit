import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const paintersSupplies: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(62),
  label: "Painter's Supplies",
  description:
    'Brushes, pigments, and a palette for creating paintings on canvas or other surfaces.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  abilities: [],
  cost: S.gp(10),
  weight: S.lbs(5),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
