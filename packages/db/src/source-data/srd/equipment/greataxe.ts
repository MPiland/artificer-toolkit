import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const greataxe: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(18),
  label: 'Greataxe',
  description: 'A massive two-handed axe.',
  category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
  properties: [
    S.EQUIPMENT_PROPERTY_CODE.MARTIAL, S.EQUIPMENT_PROPERTY_CODE.MELEE, S.EQUIPMENT_PROPERTY_CODE.HEAVY, S.EQUIPMENT_PROPERTY_CODE.TWO_HANDED
  ],
  abilities: [],
  capabilities: S.meleeWeaponCapabilities(S.equipId(18), 'SLASHING', '1d12'),
  cost: S.gp(30),
  weight: S.lbs(7),
  rarityId: S.RARITY_COMMON,
  modifiers: S.heavyWeaponModifiers(S.equipId(18)),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
