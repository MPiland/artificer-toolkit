import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const glassblowersTools: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(58),
  label: "Glassblower's Tools",
  description: 'A blowpipe and shaping tools for working molten glass into vessels and objects.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  abilities: [],
  cost: S.gp(30),
  weight: S.lbs(5),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
