import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const costumeClothes: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(132),
  label: 'Costume Clothes',
  description: 'Theatrical or masquerade garments useful for disguise or performance.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [S.EQUIPMENT_PROPERTY_CODE.CLOTHING],
  cost: S.gp(5),
  weight: S.lbs(4),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
