import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const glaive: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(17),
    label: 'Glaive',
    description: 'A polearm with a single-edged blade mounted on a long shaft.',
    category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
    properties: [S.EQUIPMENT_PROPERTY_CODE.MARTIAL, S.EQUIPMENT_PROPERTY_CODE.MELEE, S.EQUIPMENT_PROPERTY_CODE.HEAVY, S.EQUIPMENT_PROPERTY_CODE.REACH, S.EQUIPMENT_PROPERTY_CODE.TWO_HANDED],
    abilities: [],
    cost: S.gp(20),
    weight: S.lbs(6),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
