import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const smithsTools: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(64),
  label: "Smith's Tools",
  description: 'Hammers, tongs, and files for working metal at the forge.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  abilities: [],
  cost: S.gp(20),
  weight: S.lbs(8),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
