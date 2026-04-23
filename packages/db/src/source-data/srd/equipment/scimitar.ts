import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const scimitar: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(27),
  label: 'Scimitar',
  description: 'A curved, single-edged blade.',
  category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
  properties: [
    S.EQUIPMENT_PROPERTY_CODE.MARTIAL, S.EQUIPMENT_PROPERTY_CODE.MELEE, S.EQUIPMENT_PROPERTY_CODE.FINESSE, S.EQUIPMENT_PROPERTY_CODE.LIGHT
  ],
  effects: S.meleeWeaponEffects(S.equipId(27), 'SLASHING', '1d6'),
  cost: S.gp(25),
  weight: S.lbs(3),
  rarityId: S.RARITY_COMMON,
  modifiers: S.finesseWeaponModifiers(S.equipId(27)),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}

