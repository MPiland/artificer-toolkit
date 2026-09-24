import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const druidicFocusWoodenStaff: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(94),
  label: 'Druidic Focus: Wooden Staff',
  description: S.DRUIDIC_FOCUS_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(5),
  weight: S.lbs(4),
  effects: [S.passiveEquipmentClosedRuleEffect(S.equipId(94), 'EQUIPMENT_DRUIDIC_FOCUS')],
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
