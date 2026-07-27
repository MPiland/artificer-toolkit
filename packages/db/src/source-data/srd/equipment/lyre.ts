import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const lyre: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(74),
  label: 'Lyre',
  description: 'An ancient string instrument with a U-shaped frame played by plucking.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MUSICAL_INSTRUMENT],
  cost: S.gp(30),
  weight: S.lbs(2),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
