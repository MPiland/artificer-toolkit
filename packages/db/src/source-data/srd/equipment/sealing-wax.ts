import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const sealingWax: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(169),
    label: 'Sealing Wax',
    description: "Wax melted and pressed with a signet ring to seal and authenticate documents.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    cost: S.sp(5),
    weight: S.lbs(0),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
