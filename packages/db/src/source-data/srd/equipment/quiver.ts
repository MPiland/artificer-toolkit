import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const quiver: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(104),
  label: 'Quiver',
  description: 'A cylindrical container strapped to the back or hip for carrying up to 20 arrows.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [S.EQUIPMENT_PROPERTY_CODE.CONTAINER],
  abilities: [],
  cost: S.gp(1),
  weight: S.lbs(1),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
