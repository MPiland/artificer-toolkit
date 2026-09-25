import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const heavyClub: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(381),
  label: 'Heavy Club',
  description: null,
  category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
  properties: [S.EQUIPMENT_PROPERTY_CODE.MELEE],
  modifiers: S.meleeWeaponAbilityModifiers(S.equipId(381)),
  effects: S.meleeWeaponEffects(S.equipId(381), 'BLUDGEONING', '1d6', S.EQUIPMENT_GRIP.ONE_HANDED),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
