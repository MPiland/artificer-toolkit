import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const crossbowBoltCase: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(103),
    label: 'Crossbow Bolt Case',
    description: "A wooden or leather case that holds up to 20 crossbow bolts.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [S.EQUIPMENT_PROPERTY_CODE.CONTAINER],
    cost: S.gp(1),
    weight: S.lbs(1),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
