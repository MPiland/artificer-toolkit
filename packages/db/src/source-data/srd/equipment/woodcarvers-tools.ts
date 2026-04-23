import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const woodcarversTools: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(67),
  label: "Woodcarver's Tools",
  description:
    'Chisels, gouges, and knives for carving decorative or functional objects from wood.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  cost: S.gp(1),
  weight: S.lbs(5),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
