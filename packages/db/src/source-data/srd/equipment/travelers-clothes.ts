import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const travelersClothes: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(134),
  label: "Traveler's Clothes",
  description: 'Sturdy, practical garments designed for long journeys and outdoor conditions.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [S.EQUIPMENT_PROPERTY_CODE.CLOTHING],
  cost: S.gp(2),
  weight: S.lbs(4),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
