import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const shawm: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(76),
    label: 'Shawm',
    description: "A double-reed woodwind instrument with a loud, penetrating sound.",
    category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
    properties: [],
    cost: S.gp(2),
    weight: S.lbs(1),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
