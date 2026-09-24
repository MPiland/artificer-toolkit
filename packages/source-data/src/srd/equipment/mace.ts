import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const mace: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(7),
  label: 'Mace',
  description: null,
  category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
  properties: [S.EQUIPMENT_PROPERTY_CODE.SIMPLE, S.EQUIPMENT_PROPERTY_CODE.MELEE],
  modifiers: S.meleeWeaponAbilityModifiers(S.equipId(7)),
  effects: S.meleeWeaponEffects(S.equipId(7), 'BLUDGEONING', '1d6'),
  cost: S.gp(5),
  weight: S.lbs(4),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
