import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const signalWhistle: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(172),
  label: 'Signal Whistle',
  description: 'A small metal whistle for sending audible signals over short distances.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.cp(5),
  weight: S.lbs(0),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
