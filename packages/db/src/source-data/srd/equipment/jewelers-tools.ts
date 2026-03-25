import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const jewelersTools: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(59),
  label: "Jeweler's Tools",
  description:
    'Fine pliers, magnifying lenses, and polishing cloths for cutting, setting, and appraising gems.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  abilities: [],
  cost: S.gp(25),
  weight: S.lbs(2),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
