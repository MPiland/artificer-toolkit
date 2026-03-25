import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const weaversTools: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(66),
  label: "Weaver's Tools",
  description: 'A loom shuttle, needles, and thread for weaving cloth and tapestries.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  abilities: [],
  cost: S.gp(1),
  weight: S.lbs(5),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
