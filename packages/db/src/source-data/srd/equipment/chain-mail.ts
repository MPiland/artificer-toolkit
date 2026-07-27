import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const chainMail: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(47),
  label: 'Chain Mail',
  description: 'Interlocking metal rings forming a coat.',
  category: S.EQUIPMENT_CATEGORY_CODE.ARMOR,
  properties: [S.EQUIPMENT_PROPERTY_CODE.HEAVY],
  armorClass: 16,
  cost: S.gp(75),
  weight: S.lbs(55),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
