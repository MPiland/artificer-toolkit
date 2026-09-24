import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { lightHammer } from './light-hammer.js'
import * as S from './shared.js'

export const lightHammerPlus1: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(279),
  label: 'Light Hammer +1',
  description: S.MAGIC_WEAPON_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: lightHammer.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_UNCOMMON,
  maxBonus: 1,
  modifiers: S.thrownMagicWeaponModifiers(S.equipId(279), 1),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
