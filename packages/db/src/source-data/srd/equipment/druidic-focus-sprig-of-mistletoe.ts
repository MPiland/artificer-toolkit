import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const druidicFocusSprigOfMistletoe: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(92),
  label: 'Druidic Focus: Sprig of Mistletoe',
  description: S.DRUIDIC_FOCUS_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(1),
  weight: S.lbs(0),
  effects: [S.passiveEquipmentClosedRuleEffect(S.equipId(92), 'EQUIPMENT_DRUIDIC_FOCUS')],
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
