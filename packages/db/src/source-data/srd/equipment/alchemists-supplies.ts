import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const alchemistsSupplies: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(51),
  label: "Alchemist's Supplies",
  description:
    'Tools for practicing the craft of alchemy, including vials, a mortar and pestle, and common reagents.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  abilities: [],
  cost: S.gp(50),
  weight: S.lbs(8),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
