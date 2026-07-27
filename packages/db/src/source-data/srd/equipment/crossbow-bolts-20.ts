import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const crossbowBolts20: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(101),
  label: 'Crossbow Bolts (20)',
  description: 'A case of 20 short bolts for use with any crossbow.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  attributes: [S.EQUIPMENT_ATTRIBUTE.STACKABLE],
  cost: S.gp(1),
  weight: S.lbs(1.5),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
