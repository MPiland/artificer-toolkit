import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const slingBullets20: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(102),
  label: 'Sling Bullets (20)',
  description: 'A pouch of 20 lead or stone bullets for use with a sling.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  attributes: [S.EQUIPMENT_ATTRIBUTE.STACKABLE],
  cost: S.cp(4),
  weight: S.lbs(1.5),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
