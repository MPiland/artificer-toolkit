import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const ink1OunceBottle: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(144),
    label: 'Ink (1 ounce bottle)',
    description: "A small bottle of writing ink sufficient for numerous pages of script.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    abilities: [],
    cost: S.gp(10),
    weight: S.lbs(0),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
