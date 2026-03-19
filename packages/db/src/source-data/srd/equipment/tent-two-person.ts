import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const tentTwoPerson: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(177),
    label: 'Tent (two-person)',
    description: "A simple canvas shelter providing modest protection for two occupants.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    abilities: [],
    cost: S.gp(2),
    weight: S.lbs(20),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
