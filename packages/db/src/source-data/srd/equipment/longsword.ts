import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const longsword: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(22),
  label: 'Longsword',
  description: null,
  category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
  properties: [
    S.EQUIPMENT_PROPERTY_CODE.MARTIAL,
    S.EQUIPMENT_PROPERTY_CODE.MELEE,
    S.EQUIPMENT_PROPERTY_CODE.VERSATILE
  ],
  modifiers: S.meleeWeaponAbilityModifiers(S.equipId(22)),
  effects: S.meleeVersatileWeaponEffects(S.equipId(22), 'SLASHING', '1d8', '1d10'),
  cost: S.gp(15),
  weight: S.lbs(3),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
