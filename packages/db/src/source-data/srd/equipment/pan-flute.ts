import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const panFlute: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(75),
    label: 'Pan Flute',
    description: "A series of graduated pipes bound together, played by blowing across the open tops.",
    category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
    properties: [],
    cost: S.gp(12),
    weight: S.lbs(2),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
