import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const mirrorSteel: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(156),
    label: 'Mirror (steel)',
    description: "A small polished steel mirror useful for signaling, peeking around corners, or checking appearance.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    cost: S.gp(5),
    weight: S.lbs(0.5),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
