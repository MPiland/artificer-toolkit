import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const vestments: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(362),
  label: 'Vestments',
  description: 'Ceremonial religious garments worn during worship and religious duties.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [S.EQUIPMENT_PROPERTY_CODE.CLOTHING],
  cost: S.gp(1),
  weight: S.lbs(4),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
