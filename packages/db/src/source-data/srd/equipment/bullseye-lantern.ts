import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const bullseyeLantern: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(149),
  label: 'Bullseye Lantern',
  description: 'A lantern with a focused lens that casts bright light in a 60-foot cone.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(10),
  weight: S.lbs(2),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
