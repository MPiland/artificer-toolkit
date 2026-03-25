import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const magnifyingGlass: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(152),
  label: 'Magnifying Glass',
  description: 'A lens that focuses light, useful for examining fine detail or starting fires in sunlight.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  abilities: [],
  cost: S.gp(100),
  weight: S.lbs(0),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
