import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const componentPouch: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(135),
  label: 'Component Pouch',
  description:
    'A small watertight pouch containing the material components needed for arcane spells.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(25),
  weight: S.lbs(2),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
