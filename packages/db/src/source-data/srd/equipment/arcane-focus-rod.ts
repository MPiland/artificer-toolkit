import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const arcaneFocusRod: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(89),
    label: 'Arcane Focus: Rod',
    description: "A metal rod inscribed with runes, used as a focus for arcane spellcasting.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    abilities: [],
    cost: S.gp(10),
    weight: S.lbs(2),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
