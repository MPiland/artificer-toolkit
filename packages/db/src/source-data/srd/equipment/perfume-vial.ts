import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const perfumeVial: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(160),
    label: 'Perfume (vial)',
    description: "A small vial of pleasant-smelling aromatic liquid.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    cost: S.gp(5),
    weight: S.lbs(0),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
