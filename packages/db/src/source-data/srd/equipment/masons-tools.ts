import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const masonsTools: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(61),
  label: "Mason's Tools",
  description: 'Chisels, a mallet, and measuring tools for shaping and laying stone.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  abilities: [],
  cost: S.gp(10),
  weight: S.lbs(8),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
