import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const spyglass: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(175),
    label: 'Spyglass',
    description: "A brass telescope that magnifies distant objects up to twice normal range.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    cost: S.gp(1000),
    weight: S.lbs(1),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
