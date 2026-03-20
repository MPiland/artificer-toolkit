import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const signetRing: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(171),
    label: 'Signet Ring',
    description: "A ring bearing an engraved seal used to authenticate wax-sealed documents.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    abilities: [],
    cost: S.gp(5),
    weight: S.lbs(0),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
