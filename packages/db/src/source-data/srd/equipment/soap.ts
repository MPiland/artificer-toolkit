import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const soap: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(173),
  label: 'Soap',
  description: 'A bar of tallow and lye soap for cleaning wounds, clothing, or equipment.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.cp(2),
  weight: S.lbs(0),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
