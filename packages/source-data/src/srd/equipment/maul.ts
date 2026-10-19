import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const maul: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(23),
  label: 'Maul',
  description: null,
  category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
  properties: [
    S.EQUIPMENT_PROPERTY_CODE.MARTIAL,
    S.EQUIPMENT_PROPERTY_CODE.MELEE,
    S.EQUIPMENT_PROPERTY_CODE.HEAVY,
    S.EQUIPMENT_PROPERTY_CODE.TWO_HANDED,
    S.EQUIPMENT_PROPERTY_CODE.METAL
  ],
  effects: S.meleeWeaponEffects(S.equipId(23), 'BLUDGEONING', '2d6', S.EQUIPMENT_GRIP.TWO_HANDED),
  cost: S.gp(10),
  weight: S.lbs(10),
  rarityId: S.RARITY_COMMON,
  modifiers: S.heavyMeleeWeaponModifiers(S.equipId(23)),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
