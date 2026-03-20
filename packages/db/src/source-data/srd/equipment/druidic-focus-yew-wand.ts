import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const druidicFocusYewWand: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(95),
    label: 'Druidic Focus: Yew Wand',
    description: "A wand of yew wood that channels the natural magic of druids.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    abilities: [],
    cost: S.gp(10),
    weight: S.lbs(1),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
