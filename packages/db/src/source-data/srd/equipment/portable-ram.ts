import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const portableRam: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(163),
  label: 'Portable Ram',
  description: 'A heavy log fitted with handles for bashing open doors and similar barriers.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(4),
  weight: S.lbs(35),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
