import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const shovel: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(170),
  label: 'Shovel',
  description: 'An iron-bladed digging tool for excavating earth, sand, or loose stone.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(2),
  weight: S.lbs(5),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
