import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const handCrossbow: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(34),
    label: 'Hand Crossbow',
    description: 'A small, compact crossbow wielded in one hand.',
    category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
    properties: [S.EQUIPMENT_PROPERTY_CODE.MARTIAL, S.EQUIPMENT_PROPERTY_CODE.RANGED, S.EQUIPMENT_PROPERTY_CODE.AMMUNITION, S.EQUIPMENT_PROPERTY_CODE.LIGHT, S.EQUIPMENT_PROPERTY_CODE.LOADING],
    abilities: [],
    cost: S.gp(75),
    weight: S.lbs(3),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
