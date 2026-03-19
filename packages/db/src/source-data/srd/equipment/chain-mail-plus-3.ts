import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { chainMail } from './chain-mail.js'
import * as S from './shared.js'

export const chainMailPlus3: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(221),
  label: 'Chain Mail +3',
  description: 'You have a +3 bonus to AC while wearing this magic armor.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: chainMail.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: chainMail.weight,
  rarityId: S.RARITY_VERY_RARE,
  maxBonus: 3,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
