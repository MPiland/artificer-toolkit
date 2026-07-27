import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const splintArmor: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(48),
  label: 'Splint Armor',
  description: 'Narrow vertical strips of metal riveted to a leather backing.',
  category: S.EQUIPMENT_CATEGORY_CODE.ARMOR,
  properties: [S.EQUIPMENT_PROPERTY_CODE.HEAVY],
  armorClass: 17,
  cost: S.gp(200),
  weight: S.lbs(60),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
