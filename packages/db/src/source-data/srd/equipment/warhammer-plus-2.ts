import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { warhammer } from './warhammer.js'
import * as S from './shared.js'

export const warhammerPlus2: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(226),
  label: 'Warhammer +2',
  description: 'You have a +2 bonus to attack and damage rolls made with this magic weapon.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: warhammer.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: S.lbs(2),
  rarityId: S.RARITY_RARE,
  maxBonus: 2,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
