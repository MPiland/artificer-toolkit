import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const sickle: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(9),
  label: 'Sickle',
  description: null,
  category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
  properties: [
    S.EQUIPMENT_PROPERTY_CODE.SIMPLE,
    S.EQUIPMENT_PROPERTY_CODE.MELEE,
    S.EQUIPMENT_PROPERTY_CODE.LIGHT
  ],
  modifiers: S.meleeWeaponAbilityModifiers(S.equipId(9)),
  effects: S.meleeWeaponEffects(S.equipId(9), 'SLASHING', '1d4'),
  cost: S.gp(1),
  weight: S.lbs(2),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
