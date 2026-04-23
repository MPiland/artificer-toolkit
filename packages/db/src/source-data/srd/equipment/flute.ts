import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const flute: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(71),
    label: 'Flute',
    description: "A small woodwind instrument played by blowing across an embouchure hole.",
    category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
    properties: [],
    cost: S.gp(2),
    weight: S.lbs(1),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
