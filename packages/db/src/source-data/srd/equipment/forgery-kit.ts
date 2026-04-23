import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const forgeryKit: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(81),
  label: 'Forgery Kit',
  description: 'Inks, papers, and seal-making tools for duplicating documents and signatures.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  cost: S.gp(15),
  weight: S.lbs(5),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
