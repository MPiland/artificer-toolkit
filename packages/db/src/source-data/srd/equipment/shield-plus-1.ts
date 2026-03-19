import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { shield } from './shield.js'
import * as S from './shared.js'

export const shieldPlus1: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(189),
  label: 'Shield +1',
  description: 'You have a +1 bonus to AC while wielding this magic shield.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: shield.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: S.lbs(6),
  rarityId: S.RARITY_UNCOMMON,
  maxBonus: 1,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
