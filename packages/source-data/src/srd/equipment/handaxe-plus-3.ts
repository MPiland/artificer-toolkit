import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { handaxe } from './handaxe.js'
import * as S from './shared.js'

export const handaxePlus3: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(275),
  label: 'Handaxe +3',
  description: S.MAGIC_WEAPON_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: handaxe.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_VERY_RARE,
  modifiers: S.thrownMagicWeaponModifiers(S.equipId(275), 3),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
