import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const mapOrScrollCase: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(114),
  label: 'Map or Scroll Case',
  description: "This cylindrical leather case can hold up to ten rolled-up sheets of paper or five rolled-up sheets of parchment.",
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [S.EQUIPMENT_PROPERTY_CODE.CONTAINER],
  cost: S.gp(1),
  weight: S.lbs(1),
  effects: [S.passiveEquipmentClosedRuleEffect(S.equipId(114), 'EQUIPMENT_MAP_SCROLL_CASE_CAPACITY')],
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
