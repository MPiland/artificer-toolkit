import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { dagger } from './dagger.js'
import * as S from './shared.js'

export const daggerPlus2: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(253),
  label: 'Dagger +2',
  description: 'You have a +2 bonus to attack and damage rolls made with this magic weapon.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: dagger.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  weight: S.lbs(1),
  rarityId: S.RARITY_RARE,
  maxBonus: 2,
  modifiers: S.thrownMagicWeaponModifiers(S.equipId(253), 2),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
