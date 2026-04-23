import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const druidicFocusTotem: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(93),
    label: 'Druidic Focus: Totem',
    description: "A small carved figurine of an animal or nature spirit used as a druidic focus.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    cost: S.gp(1),
    weight: S.lbs(0),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
