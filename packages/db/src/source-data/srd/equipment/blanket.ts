import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const blanket: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(125),
    label: 'Blanket',
    description: "A thick wool blanket for warmth during cold nights.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    cost: S.sp(5),
    weight: S.lbs(3),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
