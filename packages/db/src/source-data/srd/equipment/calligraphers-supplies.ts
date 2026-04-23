import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const calligraphersSupplies: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(53),
  label: "Calligrapher's Supplies",
  description:
    'Inks, pens, and specialized paper for producing fine handwriting and illuminated manuscripts.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  cost: S.gp(10),
  weight: S.lbs(5),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
