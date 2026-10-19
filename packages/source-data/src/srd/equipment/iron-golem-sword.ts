import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const ironGolemSword: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(383),
  label: 'Iron Golem Sword',
  description: null,
  category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
  properties: [
    S.EQUIPMENT_PROPERTY_CODE.MELEE,
    S.EQUIPMENT_PROPERTY_CODE.REACH,
    S.EQUIPMENT_PROPERTY_CODE.METAL
  ],
  modifiers: S.meleeWeaponAbilityModifiers(S.equipId(383)),
  effects: S.meleeReachWeaponEffects(
    S.equipId(383),
    'SLASHING',
    '3d10',
    S.EQUIPMENT_GRIP.ONE_HANDED
  ),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
