import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { shortsword } from './shortsword.js'
import * as S from './shared.js'

export const shortswordPlus1: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(216),
  label: 'Shortsword +1',
  description: 'You have a +1 bonus to attack and damage rolls made with this magic weapon.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: shortsword.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: S.lbs(2),
  rarityId: S.RARITY_UNCOMMON,
  maxBonus: 1,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
