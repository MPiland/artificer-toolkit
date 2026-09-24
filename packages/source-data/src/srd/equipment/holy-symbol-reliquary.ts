import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const holySymbolReliquary: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(98),
  label: 'Holy Symbol: Reliquary',
  description: S.HOLY_SYMBOL_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(5),
  weight: S.lbs(2),
  effects: [S.passiveEquipmentClosedRuleEffect(S.equipId(98), 'EQUIPMENT_HOLY_SYMBOL')],
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
