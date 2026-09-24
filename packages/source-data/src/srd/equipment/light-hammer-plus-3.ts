import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { lightHammer } from './light-hammer.js'
import * as S from './shared.js'

export const lightHammerPlus3: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(281),
  label: 'Light Hammer +3',
  description: S.MAGIC_WEAPON_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: lightHammer.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_VERY_RARE,
  maxBonus: 3,
  modifiers: S.thrownMagicWeaponModifiers(S.equipId(281), 3),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
