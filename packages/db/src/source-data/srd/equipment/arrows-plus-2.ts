import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { arrows20 } from './arrows-20.js'
import * as S from './shared.js'

export const arrowsPlus2: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(343),
  label: 'Arrows +2',
  description: 'These 20 magic arrows grant a +2 bonus to attack and damage rolls made with them.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: arrows20.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.AMMUNITION, S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: S.lbs(1),
  rarityId: S.RARITY_RARE,
  maxBonus: 2,
  modifiers: S.magicAmmoModifiers(S.equipId(343), 2),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
