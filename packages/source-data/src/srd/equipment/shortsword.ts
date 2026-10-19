import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const shortsword: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(28),
  label: 'Shortsword',
  description: null,
  category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
  properties: [
    S.EQUIPMENT_PROPERTY_CODE.MARTIAL,
    S.EQUIPMENT_PROPERTY_CODE.MELEE,
    S.EQUIPMENT_PROPERTY_CODE.FINESSE,
    S.EQUIPMENT_PROPERTY_CODE.LIGHT,
    S.EQUIPMENT_PROPERTY_CODE.METAL
  ],
  effects: S.withOffHandAttack(
    S.equipId(28),
    S.meleeWeaponEffects(S.equipId(28), 'PIERCING', '1d6', S.EQUIPMENT_GRIP.ONE_HANDED)
  ),
  cost: S.gp(10),
  weight: S.lbs(2),
  rarityId: S.RARITY_COMMON,
  modifiers: S.withOffHandDamage(S.equipId(28), S.finesseWeaponModifiers(S.equipId(28))),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
