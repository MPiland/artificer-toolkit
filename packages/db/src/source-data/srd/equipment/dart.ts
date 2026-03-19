import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const dart: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(12),
    label: 'Dart',
    description: 'A small thrown missile weapon.',
    category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
    properties: [S.EQUIPMENT_PROPERTY_CODE.SIMPLE, S.EQUIPMENT_PROPERTY_CODE.RANGED, S.EQUIPMENT_PROPERTY_CODE.FINESSE, S.EQUIPMENT_PROPERTY_CODE.THROWN],
    abilities: [],
    cost: S.gp(0.05),
    weight: S.lbs(0.25),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
