import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const grapplingHook: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(138),
  label: 'Grappling Hook',
  description: 'A metal hook with multiple prongs for anchoring a rope to ledges or railings.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(2),
  weight: S.lbs(4),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
