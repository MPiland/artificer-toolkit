import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { dagger } from './dagger.js'
import * as S from './shared.js'

export const daggerPlus1: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(252),
  label: 'Dagger +1',
  description: S.MAGIC_WEAPON_DESCRIPTION,
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: dagger.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_UNCOMMON,
  modifiers: S.thrownMagicWeaponModifiers(S.equipId(252), 1),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
