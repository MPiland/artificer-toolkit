import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const druidicFocusSprigOfMistletoe: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(92),
    label: 'Druidic Focus: Sprig of Mistletoe',
    description: "A sacred sprig of mistletoe that serves as a focus for druidic spellcasting.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    abilities: [],
    cost: S.gp(1),
    weight: S.lbs(0),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
