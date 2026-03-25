import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const poisonersKit: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(84),
  label: "Poisoner's Kit",
  description:
    'Vials, a mortar and pestle, and reference materials for crafting and applying poisons.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  abilities: [],
  cost: S.gp(50),
  weight: S.lbs(2),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
