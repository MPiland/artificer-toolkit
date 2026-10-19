import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const halberd: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(20),
  label: 'Halberd',
  description: null,
  category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
  properties: [
    S.EQUIPMENT_PROPERTY_CODE.MARTIAL,
    S.EQUIPMENT_PROPERTY_CODE.MELEE,
    S.EQUIPMENT_PROPERTY_CODE.HEAVY,
    S.EQUIPMENT_PROPERTY_CODE.REACH,
    S.EQUIPMENT_PROPERTY_CODE.TWO_HANDED,
    S.EQUIPMENT_PROPERTY_CODE.METAL
  ],
  effects: S.meleeReachWeaponEffects(
    S.equipId(20),
    'SLASHING',
    '1d10',
    S.EQUIPMENT_GRIP.TWO_HANDED
  ),
  cost: S.gp(20),
  weight: S.lbs(6),
  rarityId: S.RARITY_COMMON,
  modifiers: S.heavyMeleeWeaponModifiers(S.equipId(20)),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
