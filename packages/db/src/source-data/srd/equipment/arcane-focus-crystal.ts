import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const arcaneFocusCrystal: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(87),
  label: 'Arcane Focus: Crystal',
  description: S.ARCANE_FOCUS_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(10),
  weight: S.lbs(1),
  effects: [S.passiveEquipmentClosedRuleEffect(S.equipId(87), 'EQUIPMENT_ARCANE_FOCUS')],
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
