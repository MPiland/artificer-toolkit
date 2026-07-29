import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const bedroll: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(123),
  label: 'Bedroll',
  description: 'A rolled blanket and sleeping pad for resting outdoors in modest comfort.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(1),
  weight: S.lbs(7),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
