import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const crossbowBolts: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(101),
  label: 'Crossbow Bolts',
  description: null,
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  attributes: [S.EQUIPMENT_ATTRIBUTE.STACKABLE],
  cost: S.cp(5),
  weight: S.lbs(0.075),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
