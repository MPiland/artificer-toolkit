import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const hoodedLantern: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(150),
  label: 'Hooded Lantern',
  description: 'A lantern with a hood that can be lowered to reduce or conceal its light.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(5),
  weight: S.lbs(2),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID,
}
