import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const holySymbolEmblem: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(97),
  label: 'Holy Symbol: Emblem',
  description: S.HOLY_SYMBOL_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(5),
  weight: S.lbs(0),
  effects: [S.passiveEquipmentClosedRuleEffect(S.equipId(97), 'EQUIPMENT_HOLY_SYMBOL')],
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
