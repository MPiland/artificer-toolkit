import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const herbalismKit: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(82),
  label: 'Herbalism Kit',
  description: 'Pouches, clippers, and reference materials for gathering and preparing medicinal plants.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [],
  abilities: [],
  cost: S.gp(5),
  weight: S.lbs(3),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
