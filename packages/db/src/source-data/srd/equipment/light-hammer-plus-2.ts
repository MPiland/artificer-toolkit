import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { lightHammer } from './light-hammer.js'
import * as S from './shared.js'

export const lightHammerPlus2: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(280),
  label: 'Light Hammer +2',
  description: 'You have a +2 bonus to attack and damage rolls made with this magic weapon.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: lightHammer.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_RARE,
  maxBonus: 2,
  modifiers: S.thrownMagicWeaponModifiers(S.equipId(280), 2),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
