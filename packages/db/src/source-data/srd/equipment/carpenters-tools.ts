import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const carpentersTools: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(54),
  label: "Carpenter's Tools",
  description:
    'Saws, hammers, chisels, and other woodworking instruments for shaping and joining timber.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  abilities: [],
  cost: S.gp(8),
  weight: S.lbs(6),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
