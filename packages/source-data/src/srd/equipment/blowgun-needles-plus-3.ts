import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { blowgunNeedles } from './blowgun-needles.js'
import * as S from './shared.js'

export const blowgunNeedlesPlus3: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(347),
  label: 'Blowgun Needles +3',
  description: S.MAGIC_AMMUNITION_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: blowgunNeedles.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.AMMUNITION, S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  effects: [S.magicAmmunitionExpirationEffect(S.equipId(347))],
  rarityId: S.RARITY_VERY_RARE,
  modifiers: S.magicAmmoModifiers(S.equipId(347), 3),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
