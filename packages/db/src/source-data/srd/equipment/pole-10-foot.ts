import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const pole10Foot: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(162),
  label: 'Pole (10-foot)',
  description: 'A sturdy wooden pole 10 feet long for probing, pushing, or bridging narrow gaps.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.cp(5),
  weight: S.lbs(7),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
