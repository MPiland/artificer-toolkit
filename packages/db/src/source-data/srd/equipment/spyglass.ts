import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const spyglass: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(175),
  label: 'Spyglass',
  description: 'Objects viewed through a spyglass are magnified to twice their size.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(1000),
  weight: S.lbs(1),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
