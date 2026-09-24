import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const panFlute: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(75),
  label: 'Pan Flute',
  description: S.MUSICAL_INSTRUMENT_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MUSICAL_INSTRUMENT],
  cost: S.gp(12),
  weight: S.lbs(2),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
