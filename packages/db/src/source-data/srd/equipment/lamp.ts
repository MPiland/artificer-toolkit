import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const lamp: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(148),
  label: 'Lamp',
  description:
    'An oil lamp that casts bright light in a 15-foot radius and dim light for an additional 30 feet.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.sp(5),
  weight: S.lbs(1),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
