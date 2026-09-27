import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const lightHammer: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(6),
  label: 'Light Hammer',
  description: null,
  category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
  properties: [
    S.EQUIPMENT_PROPERTY_CODE.SIMPLE,
    S.EQUIPMENT_PROPERTY_CODE.MELEE,
    S.EQUIPMENT_PROPERTY_CODE.LIGHT,
    S.EQUIPMENT_PROPERTY_CODE.THROWN
  ],
  modifiers: S.thrownWeaponAbilityModifiers(S.equipId(6)),
  effects: S.thrownWeaponEffects(
    S.equipId(6),
    'BLUDGEONING',
    '1d4',
    20,
    60,
    S.EQUIPMENT_GRIP.ONE_HANDED
  ),
  cost: S.gp(2),
  weight: S.lbs(2),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
