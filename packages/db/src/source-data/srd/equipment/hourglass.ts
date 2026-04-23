import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const hourglass: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(142),
    label: 'Hourglass',
    description: "A glass vessel containing sand that measures the passage of roughly one hour.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    cost: S.gp(25),
    weight: S.lbs(1),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
