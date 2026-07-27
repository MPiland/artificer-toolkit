import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const dulcimer: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(70),
  label: 'Dulcimer',
  description: 'A stringed instrument played by striking the strings with small hammers.',
  category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MUSICAL_INSTRUMENT],
  cost: S.gp(25),
  weight: S.lbs(10),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
