import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const blockAndTackle: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(126),
  label: 'Block and Tackle',
  description: 'A set of pulleys with a cable that allows lifting loads up to four times your normal capacity.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  abilities: [],
  cost: S.gp(1),
  weight: S.lbs(5),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
