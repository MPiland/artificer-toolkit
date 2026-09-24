import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const rations1Day: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(166),
  label: 'Rations (1 day)',
  description:
    'Rations consist of dry foods suitable for extended travel, including jerky, dried fruit, hardtack, and nuts.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  attributes: [S.EQUIPMENT_ATTRIBUTE.STACKABLE],
  cost: S.sp(5),
  weight: S.lbs(2),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
