import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const incense: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(361),
  label: 'Incense',
  description: 'A stick of incense burned during religious ceremonies and meditation.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  abilities: [],
  cost: S.cp(1),
  weight: S.lbs(0),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
