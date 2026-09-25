import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const glaive: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(17),
  label: 'Glaive',
  description: null,
  category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
  properties: [
    S.EQUIPMENT_PROPERTY_CODE.MARTIAL,
    S.EQUIPMENT_PROPERTY_CODE.MELEE,
    S.EQUIPMENT_PROPERTY_CODE.HEAVY,
    S.EQUIPMENT_PROPERTY_CODE.REACH,
    S.EQUIPMENT_PROPERTY_CODE.TWO_HANDED
  ],
  effects: S.meleeReachWeaponEffects(
    S.equipId(17),
    'SLASHING',
    '1d10',
    S.EQUIPMENT_GRIP.TWO_HANDED
  ),
  cost: S.gp(20),
  weight: S.lbs(6),
  rarityId: S.RARITY_COMMON,
  modifiers: S.heavyMeleeWeaponModifiers(S.equipId(17)),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
