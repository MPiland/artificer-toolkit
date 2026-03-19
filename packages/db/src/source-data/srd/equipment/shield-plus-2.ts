import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { shield } from './shield.js'
import * as S from './shared.js'

export const shieldPlus2: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(190),
  label: 'Shield +2',
  description: 'You have a +2 bonus to AC while wielding this magic shield.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: shield.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: S.lbs(6),
  rarityId: S.RARITY_RARE,
  maxBonus: 2,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
