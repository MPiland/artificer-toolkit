import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const cobblersTools: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(56),
  label: "Cobbler's Tools",
  description:
    'Lasts, awls, and leather-working implements for making and repairing footwear.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  cost: S.gp(5),
  weight: S.lbs(5),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
