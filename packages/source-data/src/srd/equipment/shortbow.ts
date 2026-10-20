import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import { arrows } from './arrows.js'
import * as S from './shared.js'

export const shortbow: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(13),
  label: 'Shortbow',
  description: null,
  category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
  properties: [
    S.EQUIPMENT_PROPERTY_CODE.SIMPLE,
    S.EQUIPMENT_PROPERTY_CODE.RANGED,
    S.EQUIPMENT_PROPERTY_CODE.AMMUNITION,
    S.EQUIPMENT_PROPERTY_CODE.TWO_HANDED
  ],
  modifiers: S.rangedWeaponAbilityModifiers(S.equipId(13)),
  effects: S.rangedWeaponEffects(
    S.equipId(13),
    'PIERCING',
    '1d6',
    80,
    320,
    S.EQUIPMENT_GRIP.TWO_HANDED
  ),
  ammunitionEquipmentId: arrows.id,
  cost: S.gp(25),
  weight: S.lbs(2),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
