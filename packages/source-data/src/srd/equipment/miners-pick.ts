import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const minersPick: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(155),
  label: "Miner's Pick",
  description: null,
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(2),
  weight: S.lbs(10),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
