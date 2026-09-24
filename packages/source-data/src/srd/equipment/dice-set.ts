import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const diceSet: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(78),
  label: 'Dice Set',
  description: S.GAMING_SET_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  cost: S.sp(1),
  weight: S.lbs(0),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
