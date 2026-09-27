import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const longbow: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(36),
  label: 'Longbow',
  description: null,
  category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
  properties: [
    S.EQUIPMENT_PROPERTY_CODE.MARTIAL,
    S.EQUIPMENT_PROPERTY_CODE.RANGED,
    S.EQUIPMENT_PROPERTY_CODE.AMMUNITION,
    S.EQUIPMENT_PROPERTY_CODE.HEAVY,
    S.EQUIPMENT_PROPERTY_CODE.TWO_HANDED
  ],
  effects: S.rangedWeaponEffects(
    S.equipId(36),
    'PIERCING',
    '1d8',
    150,
    600,
    S.EQUIPMENT_GRIP.TWO_HANDED
  ),
  cost: S.gp(50),
  weight: S.lbs(2),
  rarityId: S.RARITY_COMMON,
  modifiers: S.heavyRangedWeaponModifiers(S.equipId(36)),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
