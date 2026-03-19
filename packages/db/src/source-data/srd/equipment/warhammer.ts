import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const warhammer: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(31),
    label: 'Warhammer',
    description: 'A heavy hammer used in melee combat.',
    category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
    properties: [S.EQUIPMENT_PROPERTY_CODE.MARTIAL, S.EQUIPMENT_PROPERTY_CODE.MELEE, S.EQUIPMENT_PROPERTY_CODE.VERSATILE],
    abilities: [],
    cost: S.gp(15),
    weight: S.lbs(2),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
