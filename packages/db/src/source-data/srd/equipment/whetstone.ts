import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const whetstone: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(181),
  label: 'Whetstone',
  description: 'A flat stone used to sharpen bladed weapons and tools.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  attributes: [S.EQUIPMENT_ATTRIBUTE.STACKABLE],
  cost: S.cp(1),
  weight: S.lbs(1),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
