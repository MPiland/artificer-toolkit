import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const cooksUtensils: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(57),
  label: "Cook's Utensils",
  description:
    'Pots, pans, knives, and seasoning equipment for preparing meals over a campfire or in a kitchen.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  cost: S.gp(1),
  weight: S.lbs(8),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
