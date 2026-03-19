import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const spellbook: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(174),
    label: 'Spellbook',
    description: "A leather-bound book of 100 pages in which a wizard records spells and arcane formulae.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    abilities: [],
    cost: S.gp(50),
    weight: S.lbs(3),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
