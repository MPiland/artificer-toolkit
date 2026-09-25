import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { blowgunNeedles50 } from './blowgun-needles-50.js'
import * as S from './shared.js'

export const blowgunNeedlesPlus1: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(345),
  label: 'Blowgun Needles +1',
  description: S.MAGIC_AMMUNITION_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: blowgunNeedles50.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.AMMUNITION, S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  effects: [S.magicAmmunitionExpirationEffect(S.equipId(345))],
  rarityId: S.RARITY_UNCOMMON,
  modifiers: S.magicAmmoModifiers(S.equipId(345), 1),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
