import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { scaleMail } from './scale-mail.js'
import * as S from './shared.js'

export const scaleMailPlus3: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(209),
  label: 'Scale Mail +3',
  description: 'You have a +3 bonus to AC while wearing this magic armor.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: scaleMail.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: scaleMail.weight,
  rarityId: S.RARITY_VERY_RARE,
  maxBonus: 3,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
