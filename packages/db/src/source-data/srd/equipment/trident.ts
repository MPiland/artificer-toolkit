import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const trident: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(29),
  label: 'Trident',
  description: 'A three-pronged polearm used for thrusting or throwing.',
  category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
  properties: [
    S.EQUIPMENT_PROPERTY_CODE.MARTIAL, S.EQUIPMENT_PROPERTY_CODE.MELEE, S.EQUIPMENT_PROPERTY_CODE.THROWN, S.EQUIPMENT_PROPERTY_CODE.VERSATILE
  ],
  abilities: [],
  capabilities: S.thrownVersatileWeaponCapabilities(S.equipId(29), 'PIERCING', '1d6', '1d8', 20),
  cost: S.gp(5),
  weight: S.lbs(4),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
