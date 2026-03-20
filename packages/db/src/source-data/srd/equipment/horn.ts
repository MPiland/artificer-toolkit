import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const horn: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(72),
    label: 'Horn',
    description: "A brass or bone wind instrument producing a resonant, carrying tone.",
    category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
    properties: [],
    abilities: [],
    cost: S.gp(3),
    weight: S.lbs(2),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
