import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { blowgunNeedles50 } from './blowgun-needles-50.js'
import * as S from './shared.js'

export const blowgunNeedlesPlus3: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(347),
  label: 'Blowgun Needles +3',
  description: 'These 50 magic blowgun needles grant a +3 bonus to attack and damage rolls made with them.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: blowgunNeedles50.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.AMMUNITION, S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: S.lbs(1),
  rarityId: S.RARITY_VERY_RARE,
  maxBonus: 3,
  modifiers: S.magicAmmoModifiers(S.equipId(347), 3),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
